import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HighlightLeaderboard from '../components/Highlights/HighlightLeaderboard';

describe('HighlightLeaderboard Component', () => {
  const mockClips = [
    {
      id: 'clip_01',
      start: 4.5,
      end: 14.2,
      duration: 9.7,
      title: 'The Viral Hook Secret',
      virality_score: 96,
      score: 96,
      reason: 'Loud applause opening and fast speaking rate (3.4 wps)',
      reasons: ['Loud applause opening', 'Fast speaking rate (3.4 wps)', 'Keyword trigger'],
      transcript_snippet: 'The secret reason why everyone fails at virality revealed.'
    },
    {
      id: 'clip_02',
      start: 15.0,
      end: 25.5,
      duration: 10.5,
      title: 'Topic Transition with Visual Cut',
      virality_score: 91,
      score: 91,
      reason: 'Scene cut transition and fast speech delivery (3.2 wps) on topic shift',
      reasons: ['Scene cut at topic transition', 'Fast speech delivery (3.2 wps)'],
      transcript_snippet: 'When you change your hook by 300 percent, viewers stay hooked.'
    },
    {
      id: 'clip_03',
      start: 26.0,
      end: 35.0,
      duration: 9.0,
      title: 'Zero to Millions Formula',
      virality_score: 87,
      score: 87,
      reason: 'High audio amplitude peak with punchline payoff',
      reasons: ['High audio amplitude peak', 'Punchline payoff'],
      transcript_snippet: 'This is the exact formula that took our channel from zero to millions.'
    },
    {
      id: 'clip_04',
      start: 36.0,
      end: 46.5,
      duration: 10.5,
      title: 'Visual Novelty Pacing',
      virality_score: 82,
      score: 82,
      reason: 'Visual novelty (2 scene transitions) with steady pacing',
      reasons: ['Visual novelty (2 scene cuts)', 'Steady speech tempo'],
      transcript_snippet: 'Visual cuts every 3 seconds keep mobile attention locked into the video.'
    },
    {
      id: 'clip_05',
      start: 48.0,
      end: 58.0,
      duration: 10.0,
      title: 'Closing Actionable Rules',
      virality_score: 78,
      score: 78,
      reason: 'Topic transition and clear vocal volume summary',
      reasons: ['Topic transition', 'Clean sentence ending'],
      transcript_snippet: 'Apply these three rules to your next video upload for instant results.'
    }
  ];

  it('renders at least 5 segments with times and descending scores', () => {
    render(<HighlightLeaderboard clips={mockClips} onSelectClip={vi.fn()} />);

    // Shows 5 segments count badge
    expect(screen.getByText('5 Segments')).toBeInTheDocument();

    // Check all scores are rendered
    expect(screen.getByText(/96 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/91 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/87 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/82 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/78 \/ 100/)).toBeInTheDocument();

    // Check times are rendered
    expect(screen.getByText(/4\.5s – 14\.2s/)).toBeInTheDocument();
    expect(screen.getByText(/15\.0s – 25\.5s/)).toBeInTheDocument();
    expect(screen.getByText(/26\.0s – 35\.0s/)).toBeInTheDocument();
    expect(screen.getByText(/36\.0s – 46\.5s/)).toBeInTheDocument();
    expect(screen.getByText(/48\.0s – 58\.0s/)).toBeInTheDocument();

    // Check explainable reasons are rendered
    expect(screen.getByText(/Loud applause opening and fast speaking rate/)).toBeInTheDocument();
    expect(screen.getByText(/Scene cut transition and fast speech delivery/)).toBeInTheDocument();
  });

  it('switches to table view and displays times and scores', () => {
    const handleSelect = vi.fn();
    render(<HighlightLeaderboard clips={mockClips} onSelectClip={handleSelect} />);

    // Click table mode button
    const tableBtn = screen.getByTitle('Segments Table View (Times & Scores)');
    fireEvent.click(tableBtn);

    // Verify table headers
    expect(screen.getByText('Time Range')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Explainable Reason')).toBeInTheDocument();

    // Verify row contents
    expect(screen.getAllByText('Select')).toHaveLength(5);

    // Click select on the first row
    fireEvent.click(screen.getAllByText('Select')[0]);
    expect(handleSelect).toHaveBeenCalledWith(mockClips[0]);
  });
});
