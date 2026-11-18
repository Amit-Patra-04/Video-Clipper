import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Header from '../components/Common/Header';

describe('Header Smoke Test', () => {
  it('renders the header title, pro studio badge, and GSAP indicator', () => {
    const onReset = vi.fn();

    render(<Header currentStage="editor" onReset={onReset} />);

    // Check main title and branding
    expect(screen.getByText(/AutoClip AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Pro Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Video Highlights & Kinetic Shorts Engine/i)).toBeInTheDocument();

    // Check GSAP motion status indicator
    expect(screen.getByText(/GSAP Engine Active/i)).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByRole('button', { name: /New Project/i })).toBeInTheDocument();
  });
});
