import { formatFileSize } from './format'

describe('formatFileSize', () => {
  it('returns a dash for empty or invalid sizes', () => {
    expect(formatFileSize(null)).toBe('-')
    expect(formatFileSize(0)).toBe('-')
  })

  it('shows bytes without decimals', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('scales to KB and MB with one decimal', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
