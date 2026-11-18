import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IngestionFlow from '../components/Ingestion/IngestionFlow';
import { apiClient } from '../api/client';

describe('IngestionFlow Component', () => {
  it('renders both (a) File Upload and (b) YouTube URL tabs', () => {
    render(<IngestionFlow onDemoLoad={vi.fn()} />);

    expect(screen.getByText(/\(a\) Video File Upload/i)).toBeInTheDocument();
    expect(screen.getByText(/\(b\) YouTube URL Input/i)).toBeInTheDocument();
    expect(screen.getByText(/Security Guardrail Active/i)).toBeInTheDocument();
  });

  it('handles video file upload submission and displays job queued feedback with Job ID', async () => {
    vi.spyOn(apiClient, 'uploadToEndpoint').mockResolvedValueOnce({
      job_id: 'job_test987',
      video_id: 'vid_test123',
      status: 'queued',
      type: 'file_upload',
      filename: 'clip.mp4',
      message: 'Upload successful, job queued'
    });

    const onSuccess = vi.fn();
    render(<IngestionFlow onSuccess={onSuccess} onDemoLoad={vi.fn()} />);

    const file = new File(['fake-mp4-data'], 'clip.mp4', { type: 'video/mp4' });
    const fileInput = screen.getByLabelText ? document.querySelector('input[type="file"]') : null;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(screen.getByText('clip.mp4')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Submit to Ingestion Pipeline/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(apiClient.uploadToEndpoint).toHaveBeenCalled();
    expect(screen.getByText(/Upload successful, job queued/i)).toBeInTheDocument();
    expect(screen.getByText(/job_test987/i)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('displays policy warning when submitting YouTube link without permissions', async () => {
    const policyErr = new Error(
      'YouTube Policy Warning: Direct programmatic downloading is disallowed.'
    );
    policyErr.status = 403;
    policyErr.isPolicyWarning = true;
    policyErr.detail = 'YouTube Policy Warning: Direct programmatic downloading is disallowed.';

    vi.spyOn(apiClient, 'uploadToEndpoint').mockRejectedValueOnce(policyErr);

    render(<IngestionFlow onDemoLoad={vi.fn()} />);

    const ytTabBtn = screen.getByText(/\(b\) YouTube URL Input/i);
    fireEvent.click(ytTabBtn);

    const input = screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i);
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });

    const submitBtn = screen.getByRole('button', { name: /Submit to Ingestion Pipeline/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByText(/Policy Restriction Warning/i)).toBeInTheDocument();
    expect(
      screen.getByText(/YouTube Policy Warning: Direct programmatic downloading is disallowed/i)
    ).toBeInTheDocument();
  });

  it('displays clear Backend Server Offline banner when backend port is unreachable', async () => {
    const netErr = new Error('Backend server is offline (HTTP 504 Bad Gateway/Timeout).');
    netErr.status = 504;
    netErr.isNetworkError = true;

    vi.spyOn(apiClient, 'uploadToEndpoint').mockRejectedValueOnce(netErr);

    render(<IngestionFlow onDemoLoad={vi.fn()} />);

    const ytTabBtn = screen.getByText(/\(b\) YouTube URL Input/i);
    fireEvent.click(ytTabBtn);

    const input = screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i);
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });

    const submitBtn = screen.getByRole('button', { name: /Submit to Ingestion Pipeline/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByText('Backend Server Offline')).toBeInTheDocument();
    expect(screen.getByText(/Backend server is offline/i)).toBeInTheDocument();
  });

  it('validates non-YouTube URLs before submitting', async () => {
    render(<IngestionFlow onDemoLoad={vi.fn()} />);

    const ytTabBtn = screen.getByText(/\(b\) YouTube URL Input/i);
    fireEvent.click(ytTabBtn);

    const input = screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i);
    fireEvent.change(input, { target: { value: 'https://vimeo.com/123456789' } });

    const submitBtn = screen.getByRole('button', { name: /Submit to Ingestion Pipeline/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByText('Invalid YouTube URL')).toBeInTheDocument();
  });
});
