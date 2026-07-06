import { emailToText } from './preprocess'

describe('emailToText', () => {
  it('prefers ExtractedMarkdownMessage when present', () => {
    const text = emailToText({
      ExtractedMarkdownMessage: 'Flight AB123 departs 10:00',
      RawTextBody: 'raw text version',
      RawHtmlBody: '<p>html version</p>',
    })

    expect(text).toBe('Flight AB123 departs 10:00')
  })

  it('falls back to RawTextBody when ExtractedMarkdownMessage is absent', () => {
    const text = emailToText({
      RawTextBody: 'Flight AB123 departs 10:00',
      RawHtmlBody: '<p>html version</p>',
    })

    expect(text).toBe('Flight AB123 departs 10:00')
  })

  it('falls back to RawHtmlBody, stripped of tags, when the other two are absent', () => {
    const text = emailToText({
      RawHtmlBody: '<p>Flight <b>AB123</b> departs 10:00</p>',
    })

    expect(text).toBe('Flight AB123 departs 10:00')
  })

  it('removes script and style blocks entirely', () => {
    const text = emailToText({
      RawHtmlBody: '<style>.x{color:red}</style><script>evil()</script><p>Booking confirmed</p>',
    })

    expect(text).toBe('Booking confirmed')
  })

  it('decodes common HTML entities', () => {
    const text = emailToText({
      RawHtmlBody: '<p>Terms &amp; conditions &quot;apply&quot; &#39;now&#39; &nbsp;&lt;here&gt;</p>',
    })

    expect(text).toBe('Terms & conditions "apply" \'now\' <here>')
  })

  it('collapses excessive whitespace', () => {
    const text = emailToText({
      RawTextBody: 'Line one\n\n\n\n\nLine two    with   spaces',
    })

    expect(text).toBe('Line one\n\nLine two with spaces')
  })

  it('returns an empty string for an empty body', () => {
    expect(emailToText({})).toBe('')
  })

  it('returns an empty string for a whitespace-only body', () => {
    expect(emailToText({ RawTextBody: '   \n\n   ' })).toBe('')
  })

  it('returns an empty string for image-only HTML', () => {
    const text = emailToText({
      RawHtmlBody: '<img src="logo.png" alt="logo" /><img src="banner.png" />',
    })

    expect(text).toBe('')
  })

  it('truncates text longer than the 12,000 character cap', () => {
    const text = emailToText({ RawTextBody: 'a'.repeat(13_000) })

    expect(text).toHaveLength(12_000)
  })
})
