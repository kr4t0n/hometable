import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'

export function RecipeDetailPage() {
  const { id } = useParams()
  const recipeId = Number(id)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => api.getRecipe(recipeId),
    enabled: Number.isFinite(recipeId),
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

  return (
    <article className="space-y-4">
      <Link to="/" className="text-sm text-muted-foreground underline">
        ← All recipes
      </Link>
      <h1 className="font-serif text-3xl font-bold">{data.title}</h1>
      {data.description && <p className="text-muted-foreground">{data.description}</p>}
      <p className="text-sm text-muted-foreground">
        The full detail view (media gallery, ingredients, steps) arrives in the next iteration.
      </p>
    </article>
  )
}
