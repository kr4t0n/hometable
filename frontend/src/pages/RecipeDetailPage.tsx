import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, Minus, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { MediaPlayer } from '@/components/MediaPlayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-20 w-full" />
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
  const current = servings ?? baseServings
  const factor = baseServings && current ? current / baseServings : 1
  const hero = data.media.find((m) => m.id === data.cover_media_id) ?? data.media[0]
  const rest = data.media.filter((m) => m.id !== hero?.id)
  const totalTime =
    data.prep_time_min || data.cook_time_min
      ? (data.prep_time_min ?? 0) + (data.cook_time_min ?? 0)
      : null

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft /> All recipes
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/recipes/${data.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (window.confirm('Delete this recipe? This cannot be undone.')) del.mutate()
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      {hero && <MediaPlayer media={hero} className="aspect-video rounded-2xl shadow-card" />}

      <header className="space-y-4">
        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t) => (
              <Badge key={t.id}>{t.name}</Badge>
            ))}
          </div>
        )}
        <h1 className="text-display font-semibold text-balance">{data.title}</h1>
        {data.description && (
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {data.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3 text-sm">
          {totalTime != null && (
            <span className="num inline-flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>
                <span className="font-medium">{totalTime} min</span> total
              </span>
            </span>
          )}
          {data.prep_time_min != null && (
            <span className="num text-muted-foreground">Prep {data.prep_time_min}m</span>
          )}
          {data.cook_time_min != null && (
            <span className="num text-muted-foreground">Cook {data.cook_time_min}m</span>
          )}
          {baseServings != null && (
            <span className="num inline-flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {baseServings} servings
            </span>
          )}
        </div>
      </header>

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rest.map((m) => (
            <MediaPlayer key={m.id} media={m} className="aspect-square rounded-xl" />
          ))}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[20rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold">Ingredients</h2>
              {baseServings != null && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label="Fewer servings"
                    onClick={() => setServings(Math.max(1, (current ?? 1) - 1))}
                  >
                    <Minus />
                  </Button>
                  <span className="num w-6 text-center text-sm font-medium">{current}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label="More servings"
                    onClick={() => setServings((current ?? 1) + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
              )}
            </div>
            <ul>
              {data.ingredients.map((i) => (
                <li
                  key={i.id}
                  className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0"
                >
                  <span>{i.name}</span>
                  <span className="num shrink-0 font-medium text-muted-foreground">
                    {[scaleQuantity(i.quantity, factor), i.unit].filter(Boolean).join(' ')}
                  </span>
                </li>
              ))}
              {data.ingredients.length === 0 && (
                <li className="py-2 text-sm text-muted-foreground">No ingredients listed.</li>
              )}
            </ul>
          </div>
        </aside>

        <section className="space-y-5">
          <h2 className="font-serif text-2xl font-semibold">Method</h2>
          <ol className="space-y-6">
            {data.steps.map((s, idx) => (
              <li key={s.id} className="flex gap-4">
                <span className="num flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 font-serif text-lg font-semibold text-primary">
                  {idx + 1}
                </span>
                <p className="pt-1 leading-relaxed">{s.instruction}</p>
              </li>
            ))}
            {data.steps.length === 0 && <li className="text-muted-foreground">No steps yet.</li>}
          </ol>
        </section>
      </div>
    </article>
  )
}
