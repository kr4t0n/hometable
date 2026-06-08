import { useState } from 'react'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { RecipeCard } from '@/components/RecipeCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useDebounce } from '@/lib/useDebounce'
import { cn } from '@/lib/utils'

export function RecipeListPage() {
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const q = useDebounce(search, 300)

  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => api.listTags() })
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['recipes', q, selectedTags],
    queryFn: () =>
      api.listRecipes({
        q: q || undefined,
        tag: selectedTags.length ? selectedTags : undefined,
      }),
    // Keep showing the current results while the next query loads, so typing
    // updates the grid in place instead of flashing skeletons each keystroke.
    placeholderData: keepPreviousData,
  })

  const toggleTag = (name: string) =>
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    )

  const hasFilters = q.length > 0 || selectedTags.length > 0

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Your cookbook
          </p>
          <h1 className="text-display font-semibold">Recipes</h1>
          <p className="max-w-md text-muted-foreground">
            Everything you cook, gathered in one warm place.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or ingredient…"
            className="h-11 rounded-full pl-10 pr-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </header>

      {tagsQuery.data && tagsQuery.data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tagsQuery.data.map((t) => {
            const active = selectedTags.includes(t.name)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.name)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {t.name}
              </button>
            )
          })}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}
      {isError && (
        <p className="text-destructive">Failed to load recipes: {(error as Error).message}</p>
      )}
      {data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed py-20 text-center">
          <p className="mb-1 font-serif text-xl">
            {hasFilters ? 'Nothing matches yet' : 'Your cookbook is empty'}
          </p>
          <p className="mb-5 text-sm text-muted-foreground">
            {hasFilters ? 'Try a different search or tag.' : 'Add your first recipe to get started.'}
          </p>
          {!hasFilters && (
            <Button asChild>
              <Link to="/recipes/new">
                <Plus /> New recipe
              </Link>
            </Button>
          )}
        </div>
      )}
      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  )
}
