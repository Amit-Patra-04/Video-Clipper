import os
import re
import json
import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.core.logger import logger
from app.models.schemas import (
    MetadataGenerateResponse,
    YouTubeTitleVariation,
    ChapterItem
)

# Official YouTube Shorts & Hashtags Policies (YouTube Support Citation)
OFFICIAL_YOUTUBE_GUIDANCE: Dict[str, str] = {
    "source_url": "https://support.google.com/youtube/answer/6390658",
    "title_rule": "YouTube titles must be 100 characters or fewer and contain natural search keywords directly from the clip.",
    "description_rule": "YouTube Shorts descriptions should be a concise 1-2 sentence overview summarizing clip content.",
    "hashtag_rule": "Include up to 3 relevant hashtags. The first 3 hashtags appear above the title or in the Shorts feed.",
    "over_tagging_rule": "Over-tagging: Adding more than 60 hashtags causes YouTube to ignore every hashtag on the video, and may result in video removal under spam policies.",
    "relevance_rule": "Hashtags must relate directly to the clip. Irrelevant or misleading tags violate YouTube Community Guidelines."
}

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
    "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me",
    "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only",
    "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's",
    "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they",
    "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't",
    "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom",
    "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves", "just", "like", "get", "got", "make", "made", "going",
    "video", "clip", "highlight", "core", "explaining", "thing", "things"
}


def extract_clip_keywords(transcript_text: str, fallback_title: str) -> List[str]:
    """Extract top descriptive content keywords from clip title and transcript."""
    # First, collect meaningful title keywords
    title_words = [
        w.capitalize() for w in re.findall(r'[a-zA-Z]{3,}', fallback_title)
        if w.lower() not in STOP_WORDS
    ]

    # Next, collect transcript keywords
    words = re.findall(r'[a-zA-Z]{3,}', transcript_text.lower())
    content_words = [w for w in words if w not in STOP_WORDS]

    counts: Dict[str, int] = {}
    for w in content_words:
        counts[w] = counts.get(w, 0) + 1

    sorted_keywords = sorted(counts.keys(), key=lambda k: counts[k], reverse=True)
    transcript_keywords = [k.capitalize() for k in sorted_keywords]

    # Prioritize title keywords first (since title is the established clip theme), followed by transcript keywords
    combined = []
    seen = set()
    for kw in title_words + transcript_keywords:
        if kw.lower() not in seen:
            seen.add(kw.lower())
            combined.append(kw)

    if not combined:
        combined = ["Virality", "Secret", "Growth"]

    return combined[:6]


def enforce_title_length(title: str, max_chars: int = 100) -> str:
    """Enforce strict <= 100 chars limit per YouTube title requirements."""
    cleaned = re.sub(r'\s+', ' ', title).strip()
    if len(cleaned) <= max_chars:
        return cleaned
    truncated = cleaned[:max_chars].rsplit(' ', 1)[0]
    return truncated if truncated else cleaned[:max_chars]


def count_sentences(text: str) -> int:
    """Count number of sentences in description."""
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
    return max(1, len(sentences))


def enforce_sentence_limit(text: str, max_sentences: int = 2) -> str:
    """Keep description within 1-2 concise sentences for YouTube Shorts."""
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
    if not sentences:
        return text.strip()
    selected = sentences[:max_sentences]
    result = " ".join(selected)
    if not result.endswith(('.', '!', '?')):
        result += "."
    return result


def sanitize_and_filter_hashtags(tags: List[str], max_count: int = 3) -> List[str]:
    """
    Sanitize and filter hashtags:
    1. Up to 3 relevant hashtags per Shorts best practices.
    2. Ignore any hashtag exceeding 30 characters.
    3. Ensure # prefix and alphanumeric characters.
    """
    sanitized: List[str] = []
    seen = set()

    for tag in tags:
        cleaned = re.sub(r'[^a-zA-Z0-9]', '', tag)
        if not cleaned:
            continue
        if len(cleaned) > 30:
            logger.warning(f"Ignoring hashtag exceeding 30 characters: #{cleaned}")
            continue
        formatted = f"#{cleaned}"
        if formatted.lower() not in seen:
            seen.add(formatted.lower())
            sanitized.append(formatted)
        if len(sanitized) >= max_count:
            break

    # Ensure #Shorts is present for Shorts optimization
    if not any(h.lower() == "#shorts" for h in sanitized):
        if len(sanitized) >= max_count:
            sanitized[max_count - 1] = "#Shorts"
        else:
            sanitized.insert(0, "#Shorts")

    return sanitized[:max_count]


def check_over_tagging(tags_count: int) -> Optional[str]:
    """Check against YouTube official over-tagging policy (>60 tags)."""
    if tags_count > 60:
        return (
            "Over-tagging Alert (>60 tags detected): Official YouTube policy "
            "(https://support.google.com/youtube/answer/6390658) states that if a video "
            "has more than 60 hashtags, YouTube ignores all hashtags on that video. "
            "Over-tagging may also result in video removal under spam and deceptive practices policies."
        )
    return None


class MetadataGenerator:
    """
    AI YouTube Metadata Generator.
    Produces high-CTR titles (<=100 chars with clip keywords), SEO-optimized descriptions
    (1-2 sentences), up to 3 hashtags (<=30 chars), and over-tagging alerts citing YouTube Support.
    """

    def __init__(self):
        self.openai_key = settings.OPENAI_API_KEY
        self.gemini_key = settings.GEMINI_API_KEY

    async def generate_metadata(
        self,
        video_id: str,
        clip_id: Optional[str],
        title: str,
        transcript_text: str,
        custom_context: Optional[str] = None,
        tags_count: int = 0
    ) -> MetadataGenerateResponse:
        """Generate full metadata suite for the video/clip adhering to YouTube Shorts guidelines."""
        if self.openai_key:
            try:
                return await self._generate_with_openai(
                    video_id, clip_id, title, transcript_text, custom_context, tags_count
                )
            except Exception as e:
                logger.warning(f"OpenAI metadata generation failed: {e}. Falling back to rule-based viral engine.")

        # Default high-CTR algorithmic generator
        return self._generate_algorithmic_metadata(
            video_id, clip_id, title, transcript_text, custom_context, tags_count
        )

    async def _generate_with_openai(
        self,
        video_id: str,
        clip_id: Optional[str],
        title: str,
        transcript_text: str,
        custom_context: Optional[str],
        tags_count: int = 0
    ) -> MetadataGenerateResponse:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json"
        }

        keywords = extract_clip_keywords(transcript_text, title)

        prompt = f"""
You are a world-class YouTube Shorts virality strategist operating strictly within official YouTube policies (Citation: https://support.google.com/youtube/answer/6390658).

Clip Context & Finalized Transcript:
Original Title/Topic: {title}
Context: {custom_context or "General Short"}
Clip Transcript: {transcript_text[:2000]}
Key Terms Detected: {", ".join(keywords[:5])}

Official YouTube Rules to enforce:
1. Title: Generate 5 high-CTR title variations. Every title MUST be 100 characters or fewer and MUST contain key terms from the transcript above (e.g. {keywords[0] if keywords else 'topic'}).
2. Description: Provide a concise 1 to 2 sentence summary of this specific clip's content. Do not exceed 2 sentences. Include the word SUBSCRIBE for user engagement.
3. Hashtags: Provide at most 3 relevant hashtags based on the actual clip topic (e.g. #Shorts plus 1-2 specific topic tags). Hashtags must not exceed 30 characters each. No generic spam tags.
4. Tags: 5-8 relevant SEO keywords directly reflecting the clip's content.
5. Chapters: 2-4 timestamped chapter markers for this clip.

Respond ONLY with valid JSON following this schema:
{{
  "titles": [
    {{"title": "...", "hook_type": "Curiosity Gap", "estimated_ctr": "Very High (11-14%)"}},
    {{"title": "...", "hook_type": "Contrarian / Shocking", "estimated_ctr": "Very High (10-12%)"}},
    {{"title": "...", "hook_type": "Actionable How-To", "estimated_ctr": "High (9-11%)"}},
    {{"title": "...", "hook_type": "Urgent Warning", "estimated_ctr": "High (8-10%)"}},
    {{"title": "...", "hook_type": "Data / Number Hook", "estimated_ctr": "High (8-10%)"}}
  ],
  "description": "Sentence 1. Sentence 2.",
  "tags": ["tag1", "tag2"],
  "hashtags": ["#Shorts", "#Topic1", "#Topic2"],
  "chapters": [
    {{"timestamp": "0:00", "title": "The Hook"}},
    {{"timestamp": "0:15", "title": "The Big Reveal"}}
  ]
}}
"""
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0.7
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = json.loads(data["choices"][0]["message"]["content"])

            raw_titles = content.get("titles", [])
            titles: List[YouTubeTitleVariation] = []
            for t in raw_titles:
                title_text = enforce_title_length(t.get("title", ""), 100)
                titles.append(YouTubeTitleVariation(
                    title=title_text,
                    hook_type=t.get("hook_type", "Hook"),
                    estimated_ctr=t.get("estimated_ctr", "High"),
                    character_count=len(title_text)
                ))

            # Guard against empty titles
            if not titles:
                fallback_t = enforce_title_length(f"The Secret {keywords[0]} That Changes Everything", 100)
                titles.append(YouTubeTitleVariation(
                    title=fallback_t,
                    hook_type="Curiosity Gap",
                    estimated_ctr="High",
                    character_count=len(fallback_t)
                ))

            raw_description = content.get("description", "")
            description = enforce_sentence_limit(raw_description, 2)
            sentence_count = count_sentences(description)

            # Enforce max 3 hashtags, filter >30 chars
            hashtags = sanitize_and_filter_hashtags(content.get("hashtags", []), max_count=3)

            tags = content.get("tags", [])
            total_tags_count = max(tags_count, len(tags) + len(hashtags))
            over_tagging_warning = check_over_tagging(total_tags_count)

            chapters = [ChapterItem(**c) for c in content.get("chapters", [])]

            primary_title = titles[0].title

            return MetadataGenerateResponse(
                video_id=video_id,
                clip_id=clip_id,
                primary_title=primary_title,
                character_count=len(primary_title),
                titles=titles,
                description=description,
                sentence_count=sentence_count,
                tags=tags,
                hashtags=hashtags,
                hashtag_count=len(hashtags),
                chapters=chapters,
                official_guidance=OFFICIAL_YOUTUBE_GUIDANCE,
                over_tagging_warning=over_tagging_warning
            )

    def _generate_algorithmic_metadata(
        self,
        video_id: str,
        clip_id: Optional[str],
        title: str,
        transcript_text: str,
        custom_context: Optional[str],
        tags_count: int = 0
    ) -> MetadataGenerateResponse:
        """
        Deterministic YouTube Shorts strategy engine adhering to official guidance:
        - Title <= 100 characters containing clip keywords.
        - Description: exactly 1-2 concise sentences.
        - Up to 3 hashtags (<= 30 chars).
        - Over-tagging warning (>60 tags).
        - Official YouTube Support citation.
        """
        keywords = extract_clip_keywords(transcript_text, title)
        kw1 = keywords[0] if len(keywords) > 0 else "Secret"
        kw2 = keywords[1] if len(keywords) > 1 else "Framework"
        kw3 = keywords[2] if len(keywords) > 2 else "Strategy"

        raw_titles = [
            (f"The 1 Secret About {kw1} That Changes Everything 🤯", "Curiosity Gap", "Very High (11-14%)"),
            (f"Stop Making This {kw1} Mistake (Costing You Big)", "Urgent Warning", "Very High (10-12%)"),
            (f"Why 99% Of People Are Wrong About {kw1} ({kw2} Truth)...", "Contrarian / Shocking", "High (9-11%)"),
            (f"How To Master {kw1} In 60 Seconds ({kw3} Hack)", "Actionable How-To", "High (8-10%)"),
            (f"I Tried This 3-Step {kw1} Method And It Blew Up!", "First Person Proof", "High (8-10%)")
        ]

        titles: List[YouTubeTitleVariation] = []
        for raw_t, hook, ctr in raw_titles:
            final_t = enforce_title_length(raw_t, 100)
            titles.append(YouTubeTitleVariation(
                title=final_t,
                hook_type=hook,
                estimated_ctr=ctr,
                character_count=len(final_t)
            ))

        # 1-2 sentence description summarizing clip content with SUBSCRIBE
        sentence1 = f"Discover how {kw1} and {kw2} transform your results in this high-impact clip."
        sentence2 = f"SUBSCRIBE for daily insights and watch until the end for the key takeaway."
        description = f"{sentence1} {sentence2}"
        sentence_count = 2

        # Exactly up to 3 relevant hashtags
        raw_hashtags = ["#Shorts", f"#{kw1}", f"#{kw2}"]
        hashtags = sanitize_and_filter_hashtags(raw_hashtags, max_count=3)

        tags = [
            kw1.lower(),
            f"{kw1.lower()} {kw2.lower()}",
            f"{kw1.lower()} tips",
            f"{kw2.lower()} secrets",
            "shorts",
            "viral shorts",
            "productivity",
            "content creation"
        ]

        # Check over-tagging rule (>60 tags)
        total_tags_count = max(tags_count, len(tags) + len(hashtags))
        over_tagging_warning = check_over_tagging(total_tags_count)

        chapters = [
            ChapterItem(timestamp="0:00", title=f"The {kw1} Hook"),
            ChapterItem(timestamp="0:12", title=f"The {kw2} Breakdown"),
            ChapterItem(timestamp="0:32", title=f"The {kw3} Strategy"),
            ChapterItem(timestamp="0:48", title="Final Key Takeaway")
        ]

        primary_title = titles[0].title

        return MetadataGenerateResponse(
            video_id=video_id,
            clip_id=clip_id,
            primary_title=primary_title,
            character_count=len(primary_title),
            titles=titles,
            description=description,
            sentence_count=sentence_count,
            tags=tags,
            hashtags=hashtags,
            hashtag_count=len(hashtags),
            chapters=chapters,
            official_guidance=OFFICIAL_YOUTUBE_GUIDANCE,
            over_tagging_warning=over_tagging_warning
        )


metadata_generator = MetadataGenerator()
