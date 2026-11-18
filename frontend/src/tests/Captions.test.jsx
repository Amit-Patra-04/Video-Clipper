import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KineticCaptions from '../components/Editor/KineticCaptions';
import CaptionCustomizer from '../components/Editor/CaptionCustomizer';
import { generateWebVTT, sanitizeCaptionText, formatVttTimestamp } from '../utils/vtt';

describe('Caption System & WebVTT Generator', () => {
  const mockSegments = [
    {
      id: 1,
      speaker: 'Speaker 1',
      start: 4.5,
      end: 14.2,
      text: 'The secret reason why everyone fails at virality revealed.',
      words: [
        { word: 'THE', start: 4.5, end: 5.2 },
        { word: 'SECRET', start: 5.2, end: 6.4 },
        { word: 'REASON', start: 6.4, end: 7.3 }
      ]
    },
    {
      id: 2,
      speaker: 'Speaker 2',
      start: 15.0,
      end: 25.5,
      text: 'When you change your hook by 300 percent, viewers stay hooked.',
      words: []
    }
  ];

  it('formats WebVTT timestamps accurately (HH:MM:SS.mmm)', () => {
    expect(formatVttTimestamp(0)).toBe('00:00:00.000');
    expect(formatVttTimestamp(4.5)).toBe('00:00:04.500');
    expect(formatVttTimestamp(65.123)).toBe('00:01:05.123');
  });

  it('sanitizes malicious script tags to prevent XSS', () => {
    const malicious = '<script>alert("hack")</script>Safe Caption Text';
    const sanitized = sanitizeCaptionText(malicious);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('Safe Caption Text');
  });

  it('generates compliant WebVTT string from transcript segments', () => {
    const vtt = generateWebVTT(mockSegments);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:04.500 --> 00:00:14.200');
    expect(vtt).toContain('The secret reason why everyone fails at virality revealed.');
    expect(vtt).toContain('00:00:15.000 --> 00:00:25.500');
  });

  it('renders synchronized captions with semantic ARIA roles', () => {
    render(
      <KineticCaptions
        currentTime={5.0}
        segments={mockSegments}
        fontFamily="font-sans"
        fontSize={28}
        activeColor="#facc15"
      />
    );

    // Semantic HTML ARIA checks
    const region = screen.getByRole('region', { name: /Synchronized Captions/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent(/SECRET/i);
  });

  it('allows user to double-click caption to edit text and timing', () => {
    const handleUpdate = vi.fn();
    render(
      <KineticCaptions
        currentTime={5.0}
        segments={mockSegments}
        onUpdateSegment={handleUpdate}
      />
    );

    const captionEl = screen.getByRole('status');
    // Double click to enter edit mode
    fireEvent.doubleClick(captionEl);

    // Verify dialog appears
    const dialog = screen.getByRole('dialog', { name: /Edit Caption Text and Timing/i });
    expect(dialog).toBeInTheDocument();

    // Edit text
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Updated viral hook statement' } });

    // Save
    const saveBtn = screen.getByTitle('Save Caption Edit');
    fireEvent.click(saveBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        text: 'Updated viral hook statement'
      })
    );
  });

  it('changes style options in real-time in CaptionCustomizer', () => {
    const handleChange = vi.fn();
    render(
      <CaptionCustomizer
        config={{
          preset: 'hormozi',
          fontFamily: 'font-sans',
          fontSize: 28,
          fontSizeClass: 'text-2xl',
          textColorClass: 'text-yellow-400',
          activeColor: '#facc15',
          position: 'bottom'
        }}
        onChange={handleChange}
        segments={mockSegments}
      />
    );

    // Click font family option
    fireEvent.click(screen.getByText('Impact Heavy'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: 'font-black tracking-tight' })
    );

    // Click font size preset
    fireEvent.click(screen.getByText('XL'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 34, fontSizeClass: 'text-3xl' })
    );

    // Export VTT button is present
    expect(screen.getByText('Export VTT')).toBeInTheDocument();
  });
});
