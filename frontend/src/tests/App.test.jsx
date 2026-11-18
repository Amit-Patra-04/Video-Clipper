import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App component', () => {
  it('renders landing page with IngestionFlow tabs', () => {
    render(<App />);

    expect(screen.getByText(/AutoClip AI/i)).toBeInTheDocument();
    expect(screen.getByText(/\(a\) Video File Upload/i)).toBeInTheDocument();
    expect(screen.getByText(/\(b\) YouTube URL Input/i)).toBeInTheDocument();
    expect(screen.getByText(/Try Sample Video/i)).toBeInTheDocument();
  });

  it('switches to YouTube URL tab and displays policy warning notice', () => {
    render(<App />);

    const ytTabBtn = screen.getByText(/\(b\) YouTube URL Input/i);
    fireEvent.click(ytTabBtn);

    expect(screen.getByText(/YouTube API & Policy Guardrail Notice/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i)).toBeInTheDocument();
  });

  it('loads sample video studio when clicking Try Sample Video', async () => {
    render(<App />);

    const sampleBtn = screen.getByText(/Try Sample Video/i);
    await act(async () => {
      fireEvent.click(sampleBtn);
    });

    // Should now be in editor mode
    expect(screen.getByText(/Mastering High-Retention YouTube Hooks/i)).toBeInTheDocument();
    expect(screen.getByText(/Interactive Timeline/i)).toBeInTheDocument();
    const highlightElements = screen.getAllByText(/AI Highlights/i);
    expect(highlightElements.length).toBeGreaterThan(0);
  });
});
