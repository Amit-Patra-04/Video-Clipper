import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global fetch for unit tests
global.fetch = vi.fn((url, options) => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      status: 'healthy',
      titles: [
        { title: 'The 1 Secret to Virality', hook_type: 'Curiosity Gap', estimated_ctr: 'Very High' }
      ],
      description: 'Test description',
      tags: ['tag1'],
      hashtags: ['#Shorts'],
      chapters: []
    })
  })
})
