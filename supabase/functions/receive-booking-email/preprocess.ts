// Pure text-extraction for the receive-booking-email edge function: turns the Brevo inbound
// payload's body fields into clean plain text for the Groq parser. No Deno-only APIs, so - exactly
// like supabase/functions/calendar-feed/ics.ts - this module is unit-tested directly from the
// app's jest runner (see preprocess.test.ts, discovered via the `roots` entry in
// apps/mobile/jest.config.js) without a Deno shim.

const MAX_LENGTH = 12_000

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity)
}

// Regex-based, dependency-free (no jsdom): script/style blocks are dropped entirely (their
// content is never meaningful body text), remaining tags become a space so words on either side
// of a tag boundary don't get glued together.
function stripHtml(html: string): string {
  const withoutScriptsAndStyles = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  const withoutTags = withoutScriptsAndStyles.replace(/<[^>]+>/g, ' ')
  return decodeEntities(withoutTags)
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Best clean text for the LLM. Prefer ExtractedMarkdownMessage (Brevo already strips the
// signature), then RawTextBody, then RawHtmlBody stripped of markup. Empty, whitespace-only, or
// image-only bodies resolve to "".
export function emailToText(item: {
  ExtractedMarkdownMessage?: string
  RawTextBody?: string
  RawHtmlBody?: string
}): string {
  let text = ''

  if (item.ExtractedMarkdownMessage && item.ExtractedMarkdownMessage.trim()) {
    text = item.ExtractedMarkdownMessage
  } else if (item.RawTextBody && item.RawTextBody.trim()) {
    text = item.RawTextBody
  } else if (item.RawHtmlBody && item.RawHtmlBody.trim()) {
    text = stripHtml(item.RawHtmlBody)
  }

  return collapseWhitespace(text).slice(0, MAX_LENGTH)
}
