import { Clock, UtensilsCrossed, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import type { RecipeListItem } from '@/lib/api'

export function RecipeRow({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="group block">
      <article className="flex items-center gap-4 rounded-2xl border bg-card p-3 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
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
          <h3 className="truncate font-serif text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
            {recipe.title}
          </h3>
          {recipe.description && (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {recipe.description}
            </p>
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
      </article>
    </Link>
  )
}
