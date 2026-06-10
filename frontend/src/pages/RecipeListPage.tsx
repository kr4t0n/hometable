import { useEffect, useState } from 'react'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, ClipboardList, LayoutGrid, List, ListChecks, Plus, Search, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { RecipeCard } from '@/components/RecipeCard'
import { RecipeRow } from '@/components/RecipeRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useDebounce } from '@/lib/useDebounce'
import { cn } from '@/lib/utils'

type View = 'grid' | 'list'

export function RecipeListPage() {
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [view, setView] = useState<View>(() =>
    localStorage.getItem('recipeView') === 'list' ? 'list' : 'grid',
  )
  // "Plan a meal" selection mode: pick several recipes, then combine their
  // ingredients into one shopping list — or save them as a reusable meal.
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [naming, setNaming] = useState(false)
  const [mealName, setMealName] = useState('')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const q = useDebounce(search, 300)

  useEffect(() => {
    localStorage.setItem('recipeView', view)
  }, [view])

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

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const toggleSelecting = () => {
    setSelecting((prev) => !prev)
    setSelectedIds([])
    setNaming(false)
    setMealName('')
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedTags([])
  }

  const saveMeal = useMutation({
    mutationFn: () => api.createMeal({ name: mealName.trim(), recipe_ids: selectedIds }),
    onSuccess: (meal) => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      navigate(`/meals/${meal.id}`)
    },
  })

  const hasFilters = q.length > 0 || selectedTags.length > 0

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
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

      {/* Toolbar: filters read left-to-right, controls gather on the right. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {tagsQuery.data?.map((t) => {
            const active = selectedTags.includes(t.name)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.name)}
                aria-pressed={active}
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
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
              Clear
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {data && (
            <span className="num text-sm text-muted-foreground">
              {data.length} {data.length === 1 ? 'recipe' : 'recipes'}
            </span>
          )}
          <div className="inline-flex shrink-0 items-center rounded-full border bg-card p-0.5">
            {(
              [
                ['grid', LayoutGrid, 'Grid view'],
                ['list', List, 'List view'],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-colors',
                  view === key
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant={selecting ? 'secondary' : 'outline'}
            size="sm"
            onClick={toggleSelecting}
            className="shrink-0 rounded-full"
            aria-pressed={selecting}
          >
            {selecting ? <X /> : <ListChecks />}
            <span className="hidden sm:inline">{selecting ? 'Cancel' : 'Plan a meal'}</span>
          </Button>
        </div>
      </div>

      {isLoading &&
        (view === 'grid' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border bg-card shadow-card">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="flex h-40 flex-col p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-auto h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl border bg-card p-3 shadow-card"
              >
                <Skeleton className="size-20 rounded-xl sm:size-24" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ))}
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
          {hasFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              <X /> Clear filters
            </Button>
          ) : (
            <Button asChild>
              <Link to="/recipes/new">
                <Plus /> New recipe
              </Link>
            </Button>
          )}
        </div>
      )}
      {data &&
        data.length > 0 &&
        (view === 'grid' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                selectable={selecting}
                selected={selectedIds.includes(r.id)}
                onToggleSelect={() => toggleSelect(r.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {data.map((r) => (
              <RecipeRow
                key={r.id}
                recipe={r}
                selectable={selecting}
                selected={selectedIds.includes(r.id)}
                onToggleSelect={() => toggleSelect(r.id)}
              />
            ))}
          </div>
        ))}

      {selecting && (
        <div className="sticky bottom-4 z-20 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-lift backdrop-blur duration-300 animate-in fade-in slide-in-from-bottom-4">
          {naming ? (
            <form
              className="flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (mealName.trim() && !saveMeal.isPending) saveMeal.mutate()
              }}
            >
              <Input
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="Name this meal…"
                className="h-9 flex-1"
                autoFocus
              />
              <Button type="submit" size="sm" disabled={!mealName.trim() || saveMeal.isPending}>
                {saveMeal.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNaming(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {selectedIds.length === 0 ? (
                  'Select recipes to combine into a shopping list.'
                ) : (
                  <>
                    <span className="num font-semibold text-foreground">{selectedIds.length}</span>{' '}
                    {selectedIds.length === 1 ? 'recipe' : 'recipes'} selected
                  </>
                )}
              </p>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setNaming(true)}>
                    <BookmarkPlus />
                    Save as meal
                  </Button>
                  <Button asChild size="sm">
                    <Link to={`/shopping-list?ids=${selectedIds.join(',')}`}>
                      <ClipboardList />
                      Shopping list
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
