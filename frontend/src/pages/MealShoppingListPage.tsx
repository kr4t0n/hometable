import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ClipboardList, Printer } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { ShoppingList } from '@/components/ShoppingList'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

export function MealShoppingListPage() {
  const [params] = useSearchParams()
  const ids = useMemo(
    () =>
      (params.get('ids') ?? '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    [params],
  )

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['shopping-list', ids],
    queryFn: () => api.getShoppingList(ids),
    enabled: ids.length > 0,
  })

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-4 border-b pb-7 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft />
            Back to recipes
          </Link>
        </Button>
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Your meal
            </p>
            <h1 className="text-display font-semibold">Shopping list</h1>
            {data && data.recipe_titles.length > 0 && (
              <p className="max-w-md text-muted-foreground">{data.recipe_titles.join(' · ')}</p>
            )}
          </div>
          {data && data.items.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer />
              <span className="hidden sm:inline">Print</span>
            </Button>
          )}
        </div>
      </header>

      {ids.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-primary/5 py-20 text-center">
          <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="mb-1 font-serif text-xl">No recipes selected</p>
          <p className="mb-5 text-sm text-muted-foreground">
            Pick a few recipes with “Plan a meal”, then come back here.
          </p>
          <Button asChild>
            <Link to="/">Browse recipes</Link>
          </Button>
        </div>
      )}

      {ids.length > 0 && isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive">
          Failed to build the shopping list: {(error as Error).message}
        </p>
      )}

      {data && <ShoppingList items={data.items} />}
    </div>
  )
}
