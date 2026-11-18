import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MetadataStudio from '../components/Metadata/MetadataStudio';

const mockMetadata = {
  video_id: 'vid_123',
  clip_id: 'clip_456',
  primary_title: 'The 1 Secret About Quantum Computing That Changes Everything',
  character_count: 60,
  titles: [
    {
      title: 'The 1 Secret About Quantum Computing That Changes Everything',
      hook_type: 'Curiosity Gap',
      estimated_ctr: 'Very High (11-14%)',
      character_count: 60
    },
    {
      title: 'Stop Making This Quantum Computing Mistake Right Now',
      hook_type: 'Urgent Warning',
      estimated_ctr: 'Very High (10-12%)',
      character_count: 53
    }
  ],
  description: 'Discover how quantum computing transforms modern algorithms. SUBSCRIBE for daily breakdowns and insights.',
  sentence_count: 2,
  tags: ['quantum', 'computing', 'algorithms', 'tech'],
  hashtags: ['#Shorts', '#Quantum', '#Computing'],
  hashtag_count: 3,
  chapters: [
    { timestamp: '0:00', title: 'The Hook' },
    { timestamp: '0:15', title: 'The Core Insight' }
  ],
  official_guidance: {
    source_url: 'https://support.google.com/youtube/answer/6390658',
    title_rule: 'YouTube titles must be 100 characters or fewer and contain natural search keywords directly from the clip.',
    description_rule: 'YouTube Shorts descriptions should be a concise 1-2 sentence overview summarizing clip content.',
    hashtag_rule: 'Include up to 3 relevant hashtags. The first 3 hashtags appear above the title or in the Shorts feed.',
    over_tagging_rule: 'Over-tagging: Adding more than 60 hashtags causes YouTube to ignore every hashtag on the video, and may result in video removal under spam policies.'
  }
};

describe('MetadataStudio Component', () => {
  it('renders metadata studio with title, variations, description, and hashtags', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    expect(screen.getByText(/AI YouTube Shorts Growth Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/YouTube Policy Compliant/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/The 1 Secret About Quantum Computing/i)).toBeInTheDocument();
    expect(screen.getByText(/60 \/ 100 chars/i)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2 sentences/i)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 3 hashtags/i)).toBeInTheDocument();
    expect(screen.getByText('#Shorts')).toBeInTheDocument();
    expect(screen.getByText('#Quantum')).toBeInTheDocument();
  });

  it('updates title, enforces character count, and warns when exceeding 100 characters', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    const titleInput = screen.getByLabelText(/Title \(Editable \/ Manual Override\)/i);
    expect(titleInput).toBeInTheDocument();

    // Type a title exceeding 100 characters
    const longTitle = 'A'.repeat(105);
    fireEvent.change(titleInput, { target: { value: longTitle } });

    expect(screen.getByText(/105 \/ 100 chars/i)).toBeInTheDocument();
    expect(screen.getByText(/Title exceeds YouTube 100 character limit/i)).toBeInTheDocument();
  });

  it('allows clicking an A/B variation to apply it as primary title', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    const applyButtons = screen.getAllByRole('button', { name: /^Use$/i });
    expect(applyButtons.length).toBeGreaterThan(0);

    fireEvent.click(applyButtons[1]); // Click second variation
    expect(screen.getByDisplayValue(/Stop Making This Quantum Computing Mistake/i)).toBeInTheDocument();
  });

  it('tracks description sentence count and warns when exceeding 2 sentences', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    const descInput = screen.getByLabelText(/Shorts Description/i);
    // 3 sentences
    fireEvent.change(descInput, {
      target: { value: 'First sentence. Second sentence. Third sentence should trigger warning.' }
    });

    expect(screen.getByText(/3 \/ 2 sentences/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep descriptions to 1–2 concise sentences/i)).toBeInTheDocument();
  });

  it('allows adding and removing hashtags, and warns if hashtags exceed 3', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    const tagInput = screen.getByPlaceholderText(/Add hashtag/i);
    const addBtn = screen.getByRole('button', { name: /Add/i });

    // Add a 4th hashtag
    fireEvent.change(tagInput, { target: { value: 'FutureTech' } });
    fireEvent.click(addBtn);

    expect(screen.getByText('#FutureTech')).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 3 hashtags/i)).toBeInTheDocument();
    expect(screen.getByText(/YouTube Shorts recommends at most 3 hashtags/i)).toBeInTheDocument();
  });

  it('warns when a hashtag exceeds 30 characters', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    const tagInput = screen.getByPlaceholderText(/Add hashtag/i);
    const addBtn = screen.getByRole('button', { name: /Add/i });

    // Add a tag with > 30 characters
    const longTag = 'ThisIsAnExtremelyLongHashtagThatExceedsThirtyCharacters';
    fireEvent.change(tagInput, { target: { value: longTag } });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Hashtags longer than 30 characters are ignored/i)).toBeInTheDocument();
  });

  it('displays YouTube over-tagging violation alert (>60 tags rule) with official citation', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    // Click demo button to test over-tagging warning
    const testOverTagBtn = screen.getByText(/Test >60 Tags Policy Warning/i);
    fireEvent.click(testOverTagBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/YouTube Over-tagging Policy Violation \(>60 Tags\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Learn more on YouTube Support/i)).toHaveAttribute(
      'href',
      'https://support.google.com/youtube/answer/6390658'
    );
  });

  it('toggles official YouTube policy guidelines panel', () => {
    render(<MetadataStudio metadata={mockMetadata} />);

    const policiesBtn = screen.getByRole('button', { name: /Policies/i });
    fireEvent.click(policiesBtn);

    expect(screen.getByText(/Official YouTube Shorts Best Practices/i)).toBeInTheDocument();
    expect(screen.getByText(/YouTube Support Citation/i)).toHaveAttribute(
      'href',
      'https://support.google.com/youtube/answer/6390658'
    );
    expect(screen.getByText(/Maximum 100 characters/i)).toBeInTheDocument();
  });

  it('saves manual edits via onSaveMetadata and resets to AI suggestions', () => {
    const handleSave = vi.fn();
    render(<MetadataStudio metadata={mockMetadata} onSaveMetadata={handleSave} />);

    const titleInput = screen.getByLabelText(/Title \(Editable \/ Manual Override\)/i);
    fireEvent.change(titleInput, { target: { value: 'My Custom Manual Title' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_title: 'My Custom Manual Title',
        character_count: 22,
        is_user_edited: true
      })
    );

    // Now reset to AI
    const resetBtn = screen.getByRole('button', { name: /Reset to AI/i });
    fireEvent.click(resetBtn);

    expect(screen.getByDisplayValue(mockMetadata.primary_title)).toBeInTheDocument();
  });
});
