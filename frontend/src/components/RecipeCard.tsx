import { Clock, UtensilsCrossed, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { RecipeListItem } from '@/lib/api'

export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="group block">
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {recipe.cover_url ? (
            <img
              src={recipe.cover_url}
              alt={recipe.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <UtensilsCrossed className="size-10" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="font-serif text-lg font-semibold leading-tight">{recipe.title}</h3>
          {recipe.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{recipe.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {recipe.total_time_min != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {recipe.total_time_min} min
              </span>
            )}
            {recipe.servings != null && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {recipe.servings}
              </span>
            )}
          </div>
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recipe.tags.slice(0, 3).map((t) => (
                <Badge key={t.id}>{t.name}</Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}
