import { useRef, useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Link as LinkIcon, Loader2, Star, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, uploadFile, type Media, type Recipe } from '@/lib/api'

export function MediaManager({ recipe }: { recipe: Recipe }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [embedUrl, setEmbedUrl] = useState('')
  const [uploadPct, setUploadPct] = useState<number | null>(null)
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
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploadPct !== null}
        >
          {uploadPct !== null ? <Loader2 className="animate-spin" /> : <Upload />}
          {uploadPct !== null ? `Uploading ${uploadPct}%` : 'Upload photo / video'}
        </Button>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Paste a YouTube / Vimeo link"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            className="w-56"
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
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {media.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((m, idx) => (
            <li key={m.id} className="space-y-2 rounded-lg border p-2">
              <MediaThumb media={m} />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  size="icon"
                  variant={recipe.cover_media_id === m.id ? 'default' : 'ghost'}
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
                    title="Move up"
                    onClick={() => move(idx, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Move down"
                    onClick={() => move(idx, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Remove"
                    onClick={() => remove.mutate(m.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MediaThumb({ media }: { media: Media }) {
  if (media.media_type === 'image' && media.url) {
    return <img src={media.url} alt="" className="aspect-square w-full rounded object-cover" />
  }
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {media.source === 'embed' ? (media.provider ?? 'embed') : 'video'}
    </div>
  )
}
