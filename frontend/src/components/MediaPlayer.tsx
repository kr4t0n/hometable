import { UtensilsCrossed } from 'lucide-react'

import type { Media } from '@/lib/api'
import { toEmbedUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

export function MediaPlayer({ media, className }: { media: Media; className?: string }) {
  const base = cn('w-full overflow-hidden rounded-lg bg-muted', className)

  if (media.media_type === 'image' && media.url) {
    return <img src={media.url} alt="" className={cn(base, 'object-cover')} />
  }

  if (media.source === 'embed') {
    const embed = toEmbedUrl(media)
    if (embed) {
      return (
        <div className={cn(base, 'aspect-video')}>
          <iframe
            src={embed}
            title="Embedded video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )
    }
  }

  if (media.media_type === 'video' && media.url) {
    return <video src={media.url} controls className={cn(base, 'aspect-video bg-black')} />
  }

  return (
    <div
      className={cn(base, 'flex aspect-video items-center justify-center text-muted-foreground')}
    >
      <UtensilsCrossed className="size-8" />
    </div>
  )
}
