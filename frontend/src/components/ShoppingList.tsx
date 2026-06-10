import { useState } from 'react'

import { Check, RotateCcw } from 'lucide-react'

import type { AggregatedIngredient } from '@/lib/api'
import { cn } from '@/lib/utils'

// Renders an aggregated ingredient list with local "tick off while shopping"
// state. Shared by the ephemeral shopping-list page and saved meal pages.
export function ShoppingList({ items }: { items: AggregatedIngredient[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-primary/5 py-16 text-center">
        <p className="mb-1 font-serif text-xl">No ingredients to gather</p>
        <p className="text-sm text-muted-foreground">
          These recipes don’t list any ingredients yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex h-5 items-center justify-between text-sm text-muted-foreground print:hidden">
        <span className="num" aria-live="polite">
          {checked.size} of {items.length} gathered
        </span>
        {checked.size > 0 && (
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        )}
      </div>
      <ul className="divide-y rounded-2xl border bg-card shadow-card">
        {items.map((item, i) => {
          const isChecked = checked.has(i)
          return (
            <li key={`${item.name}-${item.unit ?? ''}`}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={isChecked}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                    isChecked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  {isChecked && <Check className="size-3.5" />}
                </span>
                <span
                  className={cn('min-w-0 flex-1', isChecked && 'text-muted-foreground line-through')}
                >
                  <span className="font-medium">{item.name}</span>
                  {item.recipe_count > 1 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      from {item.recipe_count} recipes
                    </span>
                  )}
                </span>
                {(item.quantity || item.unit) && (
                  <span
                    className={cn(
                      'num shrink-0 text-sm text-muted-foreground',
                      isChecked && 'line-through',
                    )}
                  >
                    {[item.quantity, item.unit].filter(Boolean).join(' ')}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
