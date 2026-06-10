import { Check, Clock, UtensilsCrossed, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import type { RecipeListItem } from '@/lib/api'
import { cn } from '@/lib/utils'

interface RecipeRowProps {
  recipe: RecipeListItem
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function RecipeRow({ recipe, selectable, selected, onToggleSelect }: RecipeRowProps) {
  const inner = (
    <article
      className={cn(
        'flex items-center gap-4 rounded-2xl border bg-card p-3 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
        {recipe.cover_url ? (
          <img
            src={recipe.cover_url}
            alt={recipe.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
            <UtensilsCrossed className="size-7" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-serif text-lg font-semibold tracking-tight transition-colors group-hover:text-accent">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{recipe.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {recipe.total_time_min != null && (
            <span className="num inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {recipe.total_time_min} min
            </span>
          )}
          {recipe.servings != null && (
            <span className="num inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {recipe.servings}
            </span>
          )}
          {recipe.tags.slice(0, 3).map((t) => (
            <Badge key={t.id}>{t.name}</Badge>
          ))}
        </div>
      </div>
      {selectable && (
        <span
          className={cn(
            'mr-1 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
          )}
        >
          {selected && <Check className="size-4" />}
        </span>
      )}
    </article>
  )

  if (selectable) {
    return (
      <button
        type="button"
        onClick={onToggleSelect}
        aria-pressed={selected}
        className="group block w-full text-left"
      >
        {inner}
      </button>
    )
  }

  return (
    <Link to={`/recipes/${recipe.id}`} className="group block">
      {inner}
    </Link>
  )
}
