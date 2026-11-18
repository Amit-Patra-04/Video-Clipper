import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../App'

describe('App component', () => {
  it('renders landing page with upload modal and youtube input', () => {
    render(<App />)

    expect(screen.getByText(/AutoClip AI/i)).toBeInTheDocument()
    expect(screen.getByText(/Direct Video Upload/i)).toBeInTheDocument()
    expect(screen.getByText(/Authorized YouTube Import/i)).toBeInTheDocument()
    expect(screen.getByText(/Try Sample Video/i)).toBeInTheDocument()
  })

  it('loads sample video studio when clicking Try Sample Video', async () => {
    render(<App />)

    const sampleBtn = screen.getByText(/Try Sample Video/i)
    await act(async () => {
      fireEvent.click(sampleBtn)
    })

    // Should now be in editor mode
    expect(screen.getByText(/Mastering High-Retention YouTube Hooks/i)).toBeInTheDocument()
    expect(screen.getByText(/Interactive Timeline/i)).toBeInTheDocument()
    const highlightElements = screen.getAllByText(/AI Highlights/i)
    expect(highlightElements.length).toBeGreaterThan(0)
  })
})
