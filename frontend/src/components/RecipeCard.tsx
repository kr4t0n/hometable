import { Clock, Users, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import type { RecipeListItem } from '@/lib/api'

export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="group block">
      <article className="overflow-hidden rounded-2xl border bg-card shadow-card transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lift">
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
        </div>
        <div className="space-y-2.5 p-4">
          <h3 className="font-serif text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
            {recipe.title}
          </h3>
          {recipe.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {recipe.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {recipe.servings != null && (
              <span className="num inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                {recipe.servings} servings
              </span>
            )}
            {recipe.tags.slice(0, 2).map((t) => (
              <Badge key={t.id}>{t.name}</Badge>
            ))}
            {recipe.tags.length > 2 && (
              <span className="text-xs text-muted-foreground">+{recipe.tags.length - 2}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
