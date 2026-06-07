import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { RecipeCard } from '@/components/RecipeCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
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
  })

  const toggleTag = (name: string) =>
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    )

  const hasFilters = q.length > 0 || selectedTags.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">Your recipes</h1>
          <p className="text-muted-foreground">Everything in your kitchen, in one place.</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ingredient…"
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {tagsQuery.data && tagsQuery.data.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagsQuery.data.map((t) => {
            const active = selectedTags.includes(t.name)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.name)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-transparent bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {t.name}
              </button>
            )
          })}
        </div>
      )}

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
          <p className="mb-4 text-muted-foreground">
            {hasFilters ? 'No recipes match your filters.' : 'No recipes yet — add your first one.'}
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  )
}
