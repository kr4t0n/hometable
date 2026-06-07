import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { RecipeCard } from '@/components/RecipeCard'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'

export function RecipeListPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.listRecipes(),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Your recipes</h1>
        <p className="text-muted-foreground">Everything in your kitchen, in one place.</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner className="size-8" />
        </div>
      )}
      {isError && (
        <p className="text-destructive">Failed to load recipes: {(error as Error).message}</p>
      )}
      {data && data.length === 0 && (
        <div className="rounded-xl border border-dashed py-20 text-center">
          <p className="mb-4 text-muted-foreground">No recipes yet — add your first one.</p>
          <Button asChild>
            <Link to="/recipes/new">
              <Plus /> New recipe
            </Link>
          </Button>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  )
}
