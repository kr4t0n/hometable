import { useRef, useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Link as LinkIcon, Star, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, uploadFile, type Media, type Recipe } from '@/lib/api'
import { cn } from '@/lib/utils'

export function MediaManager({ recipe }: { recipe: Recipe }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [embedUrl, setEmbedUrl] = useState('')
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['recipe', recipe.id] })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    for (const file of Array.from(files)) {
      const mediaType = file.type.startsWith('video') ? 'video' : 'image'
      try {
        setUploadPct(0)
        const init = await api.initMedia(recipe.id, {
          source: 'upload',
          media_type: mediaType,
          content_type: file.type,
        })
        if (init.upload_url) await uploadFile(init.upload_url, file, setUploadPct)
        await api.completeMedia(recipe.id, init.media.id)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setUploadPct(null)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
    refresh()
  }

  const addEmbed = useMutation({
    mutationFn: () =>
      api.initMedia(recipe.id, { source: 'embed', media_type: 'video', url: embedUrl.trim() }),
    onSuccess: () => {
      setEmbedUrl('')
      refresh()
    },
    onError: (e) => setError((e as Error).message),
  })
  const setCover = useMutation({
    mutationFn: (id: number) => api.updateRecipe(recipe.id, { cover_media_id: id }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteMedia(recipe.id, id),
    onSuccess: refresh,
  })
  const reorder = useMutation({
    mutationFn: ({ id, position }: { id: number; position: number }) =>
      api.reorderMedia(recipe.id, id, position),
    onSuccess: refresh,
  })

  const media = recipe.media
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= media.length) return
    // Swap the two items' position values.
    reorder.mutate({ id: media[idx].id, position: media[target].position })
    reorder.mutate({ id: media[target].id, position: media[idx].position })
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <Upload className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Drag &amp; drop photos or videos here</p>
        {uploadPct !== null ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-1.5 w-44 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
            <span className="num text-xs text-muted-foreground">Uploading {uploadPct}%</span>
          </div>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            Browse files
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="…or paste a YouTube / Vimeo link"
          value={embedUrl}
          onChange={(e) => setEmbedUrl(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => addEmbed.mutate()}
          disabled={!embedUrl.trim() || addEmbed.isPending}
        >
          <LinkIcon /> Add link
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {media.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((m, idx) => {
            const isCover = recipe.cover_media_id === m.id
            return (
              <li key={m.id} className="space-y-2 rounded-xl border p-2">
                <div className="relative">
                  <MediaThumb media={m} />
                  {isCover && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur">
                      Cover
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    size="icon"
                    variant={isCover ? 'default' : 'ghost'}
                    className="size-8"
                    title="Set as cover"
                    onClick={() => setCover.mutate(m.id)}
                  >
                    <Star />
                  </Button>
                  <div className="flex">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Move up"
                      onClick={() => move(idx, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Move down"
                      onClick={() => move(idx, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Remove"
                      onClick={() => remove.mutate(m.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function MediaThumb({ media }: { media: Media }) {
  if (media.media_type === 'image' && media.url) {
    return <img src={media.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
  }
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {media.source === 'embed' ? (media.provider ?? 'embed') : 'video'}
    </div>
  )
}
