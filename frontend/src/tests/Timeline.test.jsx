import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Timeline from '../components/Editor/Timeline';

describe('Timeline component', () => {
  it('renders duration and trim controls', () => {
    const onTrimChange = vi.fn();
    const onSeek = vi.fn();

    const segments = [{ id: 1, speaker: 'Speaker 1', start: 0, end: 10, text: 'Hello world' }];

    render(
      <Timeline
        totalDuration={60}
        currentTime={5}
        trimStart={2}
        trimEnd={25}
        onTrimChange={onTrimChange}
        onSeek={onSeek}
        segments={segments}
      />
    );

    expect(screen.getByText(/Interactive Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/IN:/i)).toBeInTheDocument();
    expect(screen.getByText(/2.0s/i)).toBeInTheDocument();
    expect(screen.getByText(/OUT:/i)).toBeInTheDocument();
    expect(screen.getByText(/25.0s/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello world/i)).toBeInTheDocument();
  });
});
