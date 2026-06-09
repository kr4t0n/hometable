import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChefHat, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

export function MealsListPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['meals'],
    queryFn: () => api.listMeals(),
  })

  return (
    <div className="space-y-8">
      <header className="space-y-1.5 border-b pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Planning</p>
        <h1 className="text-display font-semibold">Meals</h1>
        <p className="max-w-md text-muted-foreground">
          Saved plans — each gathers a few recipes into one shopping list.
        </p>
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive">Failed to load meals: {(error as Error).message}</p>
      )}

      {data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed py-20 text-center">
          <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="mb-1 font-serif text-xl">No meals planned yet</p>
          <p className="mb-5 text-sm text-muted-foreground">
            On the Recipes page, hit “Plan a meal”, pick a few recipes, then “Save as meal”.
          </p>
          <Button asChild>
            <Link to="/">
              <ChefHat />
              Browse recipes
            </Link>
          </Button>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((m) => (
            <Link key={m.id} to={`/meals/${m.id}`} className="group block h-full">
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lift">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {m.cover_url ? (
                    <img
                      src={m.cover_url}
                      alt={m.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                      <UtensilsCrossed className="size-9" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-serif text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                    {m.name}
                  </h3>
                  <p className="num mt-1 text-sm text-muted-foreground">
                    {m.recipe_count} {m.recipe_count === 1 ? 'recipe' : 'recipes'}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
