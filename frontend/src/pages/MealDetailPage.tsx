import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Printer, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AddRecipePicker } from '@/components/AddRecipePicker'
import { ShoppingList } from '@/components/ShoppingList'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ui/confirm-button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api, type MealUpdate } from '@/lib/api'

export function MealDetailPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')

  const { data: meal, isLoading, isError, error } = useQuery({
    queryKey: ['meal', id],
    queryFn: () => api.getMeal(id),
    enabled: Number.isInteger(id) && id > 0,
  })

  // All recipes, for the "add a recipe" picker.
  const recipesQuery = useQuery({
    queryKey: ['recipes', 'all'],
    queryFn: () => api.listRecipes({ limit: 200 }),
  })

  const save = useMutation({
    mutationFn: (body: MealUpdate) => api.updateMeal(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(['meal', id], updated)
      qc.invalidateQueries({ queryKey: ['meals'] })
    },
  })

  const del = useMutation({
    mutationFn: () => api.deleteMeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      navigate('/meals')
    },
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }
  if (isError || !meal) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/meals">
            <ArrowLeft />
            All meals
          </Link>
        </Button>
        <p className="text-destructive">Failed to load meal: {(error as Error)?.message ?? 'not found'}</p>
      </div>
    )
  }

  const currentIds = meal.recipes.map((r) => r.id)
  const available = (recipesQuery.data ?? []).filter((r) => !currentIds.includes(r.id))

  const startEdit = () => {
    setNameDraft(meal.name)
    setNotesDraft(meal.notes ?? '')
    setEditing(true)
  }
  const saveEdit = () => {
    const name = nameDraft.trim()
    if (!name) return
    save.mutate({ name, notes: notesDraft.trim() || null }, { onSuccess: () => setEditing(false) })
  }
  const addRecipe = (rid: number) => save.mutate({ recipe_ids: [...currentIds, rid] })
  const removeRecipe = (rid: number) =>
    save.mutate({ recipe_ids: currentIds.filter((x) => x !== rid) })

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/meals">
            <ArrowLeft />
            All meals
          </Link>
        </Button>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <ConfirmButton
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            confirmLabel="Delete meal?"
            onConfirm={() => del.mutate()}
            disabled={del.isPending}
          >
            <Trash2 />
            <span className="hidden sm:inline">Delete</span>
          </ConfirmButton>
        </div>
      </div>

      <header className="space-y-2 border-b pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Your meal</p>
        {editing ? (
          <div className="space-y-3">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Meal name"
              className="h-12 font-serif text-2xl font-semibold"
              autoFocus
            />
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={!nameDraft.trim() || save.isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-display font-semibold">{meal.name}</h1>
              {meal.notes && <p className="mt-1 max-w-md text-muted-foreground">{meal.notes}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              aria-label="Edit meal"
              className="shrink-0 print:hidden"
            >
              <Pencil />
            </Button>
          </div>
        )}
      </header>

      <section className="space-y-3 print:hidden">
        <h2 className="font-serif text-xl font-semibold">
          Recipes <span className="num text-base font-normal text-muted-foreground">({currentIds.length})</span>
        </h2>
        {meal.recipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipes yet — add one below.</p>
        ) : (
          <ul className="space-y-2">
            {meal.recipes.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-2 pr-3 shadow-card"
              >
                <Link to={`/recipes/${r.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {r.cover_url ? (
                      <img src={r.cover_url} alt={r.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                        <UtensilsCrossed className="size-5" />
                      </div>
                    )}
                  </div>
                  <span className="truncate font-medium transition-colors group-hover:text-accent">
                    {r.title}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => removeRecipe(r.id)}
                  aria-label={`Remove ${r.title}`}
                  disabled={save.isPending}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <AddRecipePicker recipes={available} onAdd={addRecipe} disabled={save.isPending} />
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold">Shopping list</h2>
        <ShoppingList items={meal.items} />
      </section>
    </div>
  )
}
