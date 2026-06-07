import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Minus, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { MediaPlayer } from '@/components/MediaPlayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { scaleQuantity } from '@/lib/scale'

export function RecipeDetailPage() {
  const { id } = useParams()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [servings, setServings] = useState<number | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => api.getRecipe(recipeId),
    enabled: Number.isFinite(recipeId),
  })
  const del = useMutation({
    mutationFn: () => api.deleteRecipe(recipeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
      navigate('/')
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <p className="text-destructive">
        Recipe not found.{' '}
        <Link to="/" className="underline">
          Back to recipes
        </Link>
      </p>
    )
  }

  const baseServings = data.servings
  const currentServings = servings ?? baseServings
  const factor = baseServings && currentServings ? currentServings / baseServings : 1

  const hero = data.media.find((m) => m.id === data.cover_media_id) ?? data.media[0]
  const rest = data.media.filter((m) => m.id !== hero?.id)
  const totalTime =
    data.prep_time_min || data.cook_time_min
      ? (data.prep_time_min ?? 0) + (data.cook_time_min ?? 0)
      : null

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-muted-foreground underline">
          ← All recipes
        </Link>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/recipes/${data.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm('Delete this recipe? This cannot be undone.')) del.mutate()
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      {hero && <MediaPlayer media={hero} />}

      <header className="space-y-3">
        <h1 className="font-serif text-4xl font-bold leading-tight">{data.title}</h1>
        {data.description && <p className="text-muted-foreground">{data.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {totalTime != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" />
              {totalTime} min
            </span>
          )}
          {baseServings != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {baseServings} servings
            </span>
          )}
        </div>
        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t) => (
              <Badge key={t.id}>{t.name}</Badge>
            ))}
          </div>
        )}
      </header>

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rest.map((m) => (
            <MediaPlayer key={m.id} media={m} className="aspect-square" />
          ))}
        </div>
      )}

      <div className="grid gap-8 sm:grid-cols-[minmax(0,17rem)_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Ingredients</h2>
            {baseServings != null && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7"
                  aria-label="Fewer servings"
                  onClick={() => setServings(Math.max(1, (currentServings ?? 1) - 1))}
                >
                  <Minus />
                </Button>
                <span className="w-6 text-center text-sm tabular-nums">{currentServings}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7"
                  aria-label="More servings"
                  onClick={() => setServings((currentServings ?? 1) + 1)}
                >
                  <Plus />
                </Button>
              </div>
            )}
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.ingredients.map((i) => (
              <li key={i.id} className="flex gap-2">
                <span className="font-medium tabular-nums">
                  {[scaleQuantity(i.quantity, factor), i.unit].filter(Boolean).join(' ')}
                </span>
                <span>{i.name}</span>
              </li>
            ))}
            {data.ingredients.length === 0 && (
              <li className="text-muted-foreground">No ingredients listed.</li>
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">Steps</h2>
          <ol className="space-y-4">
            {data.steps.map((s, idx) => (
              <li key={s.id} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {idx + 1}
                </span>
                <p className="pt-0.5">{s.instruction}</p>
              </li>
            ))}
            {data.steps.length === 0 && <li className="text-muted-foreground">No steps yet.</li>}
          </ol>
        </section>
      </div>
    </article>
  )
}
