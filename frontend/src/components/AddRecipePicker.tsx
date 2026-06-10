import { useEffect, useRef, useState } from 'react'

import { Plus, Search, UtensilsCrossed } from 'lucide-react'

import type { RecipeListItem } from '@/lib/api'

interface AddRecipePickerProps {
  /** Recipes that can still be added (i.e. not already in the meal). */
  recipes: RecipeListItem[]
  onAdd: (id: number) => void
  disabled?: boolean
}

// A small searchable popover for adding a recipe to a meal — replaces a bare
// native <select>, so options get cover thumbnails and type-to-filter.
export function AddRecipePicker({ recipes, onAdd, disabled }: AddRecipePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close + reset the filter together so reopening always starts fresh.
  const close = () => {
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || recipes.length === 0}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-10 w-full items-center gap-2 rounded-xl border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" />
        {recipes.length === 0 ? 'Every recipe is already in this meal' : 'Add a recipe…'}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lift duration-200 animate-in fade-in slide-in-from-top-1">
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes…"
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <ul role="listbox" aria-label="Recipes" className="max-h-64 overflow-y-auto p-1">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onAdd(r.id)
                    close()
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg p-1.5 pr-3 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <span className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                    {r.cover_url ? (
                      <img src={r.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                        <UtensilsCrossed className="size-4" />
                      </span>
                    )}
                  </span>
                  <span className="truncate font-medium">{r.title}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No recipes match “{query}”.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
