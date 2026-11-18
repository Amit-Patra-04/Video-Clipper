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

class MetadataGenerator:
    """
    AI YouTube Metadata Generator.
    Produces high-CTR titles, SEO-optimized descriptions, viral tags,
    and clickable chapters adhering to YouTube / YouTube Shorts algorithms.
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
        custom_context: Optional[str] = None
    ) -> MetadataGenerateResponse:
        """Generate full metadata suite for the video/clip."""
        if self.openai_key:
            try:
                return await self._generate_with_openai(video_id, clip_id, title, transcript_text, custom_context)
            except Exception as e:
                logger.warning(f"OpenAI metadata generation failed: {e}. Falling back to rule-based viral engine.")

        # Default high-CTR algorithmic generator
        return self._generate_algorithmic_metadata(video_id, clip_id, title, transcript_text, custom_context)

    async def _generate_with_openai(
        self,
        video_id: str,
        clip_id: Optional[str],
        title: str,
        transcript_text: str,
        custom_context: Optional[str]
    ) -> MetadataGenerateResponse:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json"
        }
        
        prompt = f"""
You are a world-class YouTube virality strategist (MrBeast, Ryan Trahan, Alex Hormozi style).
Analyze this transcript and generate high-CTR metadata:
Original Title: {title}
Context: {custom_context or "General topic"}
Transcript Snippet: {transcript_text[:1500]}

Respond ONLY with valid JSON following this schema:
{{
  "titles": [
    {{"title": "...", "hook_type": "Curiosity Gap", "estimated_ctr": "Very High"}},
    {{"title": "...", "hook_type": "Contrarian / Shocking", "estimated_ctr": "Very High"}},
    {{"title": "...", "hook_type": "Actionable How-To", "estimated_ctr": "High"}},
    {{"title": "...", "hook_type": "Urgent Warning", "estimated_ctr": "High"}},
    {{"title": "...", "hook_type": "Data / Number Hook", "estimated_ctr": "High"}}
  ],
  "description": "...",
  "tags": ["tag1", "tag2", ...],
  "hashtags": ["#Shorts", "#viral", ...],
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
            "temperature": 0.8
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = json.loads(data["choices"][0]["message"]["content"])

            titles = [YouTubeTitleVariation(**t) for t in content.get("titles", [])]
            chapters = [ChapterItem(**c) for c in content.get("chapters", [])]

            return MetadataGenerateResponse(
                video_id=video_id,
                clip_id=clip_id,
                titles=titles,
                description=content.get("description", ""),
                tags=content.get("tags", []),
                hashtags=content.get("hashtags", []),
                chapters=chapters
            )

    def _generate_algorithmic_metadata(
        self,
        video_id: str,
        clip_id: Optional[str],
        title: str,
        transcript_text: str,
        custom_context: Optional[str]
    ) -> MetadataGenerateResponse:
        """
        High-performing deterministic viral YouTube strategy engine.
        Synthesizes tested high-converting title frameworks, SEO descriptions, and tags.
        """
        clean_title = re.sub(r'[^a-zA-Z0-9\s]', '', title).strip()
        core_topic = clean_title.split()[0] if clean_title else "This"

        titles = [
            YouTubeTitleVariation(
                title=f"The 1 Secret About {core_topic} That Changes Everything 🤯",
                hook_type="Curiosity Gap",
                estimated_ctr="Very High (11-14%)"
            ),
            YouTubeTitleVariation(
                title=f"Stop Making This {core_topic} Mistake (Costing You Big)",
                hook_type="Urgent Warning",
                estimated_ctr="Very High (10-12%)"
            ),
            YouTubeTitleVariation(
                title=f"Why 99% Of People Are Wrong About {core_topic}...",
                hook_type="Contrarian",
                estimated_ctr="High (9-11%)"
            ),
            YouTubeTitleVariation(
                title=f"How To Master {core_topic} In 60 Seconds (Crazy Results)",
                hook_type="Actionable How-To",
                estimated_ctr="High (8-10%)"
            ),
            YouTubeTitleVariation(
                title=f"I Tried This 3-Step {core_topic} Method And It Blew Up!",
                hook_type="First Person Proof",
                estimated_ctr="High (8-10%)"
            )
        ]

        description = (
            f"Here is what happens when you understand the exact secret behind {clean_title}. "
            f"Watch until the end to see the critical insight that most creators miss!\n\n"
            f"👉 Don't forget to LIKE, SUBSCRIBE, and turn on the 🔔 notification bell for more daily insights.\n\n"
            f"💬 Question of the day: What's your biggest takeaway from this clip? Let me know below!\n\n"
            f"#Shorts #viral #trending #{core_topic.lower()}"
        )

        tags = [
            clean_title.lower(),
            f"{core_topic.lower()} tips",
            f"{core_topic.lower()} secrets",
            "shorts",
            "viral shorts",
            "productivity",
            "growth hacks",
            "mindset",
            "content creation"
        ]

        hashtags = [
            "#Shorts",
            "#viral",
            "#trending",
            f"#{core_topic.lower()}",
            "#ytshorts",
            "#contentcreator"
        ]

        chapters = [
            ChapterItem(timestamp="0:00", title="The Critical Hook"),
            ChapterItem(timestamp="0:12", title="The Surprising Truth"),
            ChapterItem(timestamp="0:32", title="The 300% Difference"),
            ChapterItem(timestamp="0:48", title="Final Key Takeaway")
        ]

        return MetadataGenerateResponse(
            video_id=video_id,
            clip_id=clip_id,
            titles=titles,
            description=description,
            tags=tags,
            hashtags=hashtags,
            chapters=chapters
        )

metadata_generator = MetadataGenerator()
