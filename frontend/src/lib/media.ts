import type { Media } from '@/lib/api'

// Convert a stored embed URL into an embeddable iframe URL.
export function toEmbedUrl(media: Media): string | null {
  if (media.source !== 'embed' || !media.url) return null
  const url = media.url
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}
