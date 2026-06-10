import { Check, Clock, Users, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import type { RecipeListItem } from '@/lib/api'
import { cn } from '@/lib/utils'

interface RecipeCardProps {
  recipe: RecipeListItem
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function RecipeCard({ recipe, selectable, selected, onToggleSelect }: RecipeCardProps) {
  const inner = (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lift',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {recipe.cover_url ? (
          <img
            src={recipe.cover_url}
            alt={recipe.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
            <UtensilsCrossed className="size-9" />
          </div>
        )}
        {recipe.total_time_min != null && (
          <span className="num absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <Clock className="size-3.5" />
            {recipe.total_time_min} min
          </span>
        )}
        {selectable && (
          <span
            className={cn(
              'absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border-2 shadow-sm transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-white/80 bg-background/70 backdrop-blur',
            )}
          >
            {selected && <Check className="size-4" />}
          </span>
        )}
      </div>

      {/* Fixed-height text block: meta pinned to the bottom so cards align. */}
      <div className="flex h-40 flex-col p-4">
        <h3 className="line-clamp-2 font-serif text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {recipe.description}
          </p>
        )}
        <div className="mt-auto flex items-center gap-2 overflow-hidden pt-3">
          {recipe.servings != null && (
            <span className="num inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {recipe.servings}
            </span>
          )}
          {recipe.tags.slice(0, 2).map((t) => (
            <Badge key={t.id} className="shrink-0">
              {t.name}
            </Badge>
          ))}
          {recipe.tags.length > 2 && (
            <span className="shrink-0 text-xs text-muted-foreground">+{recipe.tags.length - 2}</span>
          )}
        </div>
      </div>
    </article>
  )

  if (selectable) {
    return (
      <button
        type="button"
        onClick={onToggleSelect}
        aria-pressed={selected}
        className="group block h-full w-full text-left"
      >
        {inner}
      </button>
    )
  }

  return (
    <Link to={`/recipes/${recipe.id}`} className="group block h-full">
      {inner}
    </Link>
  )
}
