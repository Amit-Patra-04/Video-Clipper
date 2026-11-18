import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Timeline from '../components/Editor/Timeline';
import AspectRatioSelector from '../components/Editor/AspectRatioSelector';
import TransitionPicker from '../components/Editor/TransitionPicker';

describe('Clip Editor UI & Timeline Components', () => {
  it('renders multi-track timeline with video, audio canvas, and speech tracks', () => {
    const onTrimChange = vi.fn();
    const onSeek = vi.fn();

    const segments = [
      { id: 1, speaker: 'Speaker 1', start: 0, end: 10, text: 'Hello world viral clip' }
    ];

    const { container } = render(
      <Timeline
        totalDuration={60}
        currentTime={5}
        trimStart={2.5}
        trimEnd={25.0}
        onTrimChange={onTrimChange}
        onSeek={onSeek}
        segments={segments}
        transition="fade"
      />
    );

    expect(screen.getByText(/Interactive Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/IN:/i)).toBeInTheDocument();
    expect(screen.getByText('2.5s')).toBeInTheDocument();
    expect(screen.getByText(/OUT:/i)).toBeInTheDocument();
    expect(screen.getByText('25.0s')).toBeInTheDocument();
    expect(screen.getByText(/Transition: FADE/i)).toBeInTheDocument();
    expect(screen.getByText(/Video Track/i)).toBeInTheDocument();
    expect(screen.getByText(/Audio Waveform/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello world viral clip/i)).toBeInTheDocument();

    // Verify HTML5 Canvas element exists for audio waveform
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('updates aspect ratio crop selection in real-time', () => {
    const onChange = vi.fn();
    render(<AspectRatioSelector value="9:16" onChange={onChange} />);

    expect(screen.getByText(/9:16 Shorts/i)).toBeInTheDocument();
    expect(screen.getByText(/1:1 Square/i)).toBeInTheDocument();
    expect(screen.getByText(/16:9 Landscape/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/1:1 Square/i));
    expect(onChange).toHaveBeenCalledWith('1:1');
  });

  it('allows selecting transitions (cut, fade, zoom) for scene cuts', () => {
    const onSelect = vi.fn();
    render(<TransitionPicker selected="cut" onSelect={onSelect} />);

    expect(screen.getByText('Jump Cut')).toBeInTheDocument();
    expect(screen.getByText('Cross Dissolve')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cross Dissolve'));
    expect(onSelect).toHaveBeenCalledWith('fade');
  });
});
