import { useMemo, type KeyboardEvent, type ReactNode } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import { MediaManager } from '@/components/MediaManager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api, type Recipe, type RecipeCreate, type RecipeUpdate } from '@/lib/api'

const numString = z.string().regex(/^\d*$/, 'Numbers only')
const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string(),
  servings: numString,
  prep_time_min: numString,
  cook_time_min: numString,
  tags: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
      unit: z.string(),
    }),
  ),
  steps: z.array(z.object({ instruction: z.string() })),
})
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  title: '',
  description: '',
  servings: '',
  prep_time_min: '',
  cook_time_min: '',
  tags: '',
  ingredients: [{ name: '', quantity: '', unit: '' }],
  steps: [{ instruction: '' }],
}

function toForm(r: Recipe): FormValues {
  return {
    title: r.title,
    description: r.description ?? '',
    servings: r.servings != null ? String(r.servings) : '',
    prep_time_min: r.prep_time_min != null ? String(r.prep_time_min) : '',
    cook_time_min: r.cook_time_min != null ? String(r.cook_time_min) : '',
    tags: r.tags.map((t) => t.name).join(', '),
    ingredients: r.ingredients.length
      ? r.ingredients.map((i) => ({ name: i.name, quantity: i.quantity ?? '', unit: i.unit ?? '' }))
      : [{ name: '', quantity: '', unit: '' }],
    steps: r.steps.length ? r.steps.map((s) => ({ instruction: s.instruction })) : [{ instruction: '' }],
  }
}

function toPayload(v: FormValues): RecipeCreate {
  const num = (s: string) => (s.trim() === '' ? null : Number(s))
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    servings: num(v.servings),
    prep_time_min: num(v.prep_time_min),
    cook_time_min: num(v.cook_time_min),
    tags: v.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    ingredients: v.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity.trim() || null,
        unit: i.unit.trim() || null,
      })),
    steps: v.steps
      .filter((s) => s.instruction.trim())
      .map((s) => ({ instruction: s.instruction.trim() })),
  }
}

// Card-style grouping so the long form reads as a few digestible chapters.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function RecipeEditorPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const recipeId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => api.getRecipe(recipeId),
    enabled: isEdit && Number.isFinite(recipeId),
  })

  const values = useMemo(() => (recipe ? toForm(recipe) : EMPTY), [recipe])
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values })
  const ingredients = useFieldArray({ control: form.control, name: 'ingredients' })
  const steps = useFieldArray({ control: form.control, name: 'steps' })
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => api.listTags() })

  const addTag = (name: string) => {
    const list = form
      .getValues('tags')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!list.includes(name)) {
      form.setValue('tags', [...list, name].join(', '), { shouldDirty: true })
    }
  }

  // Enter inside an ingredient row inserts the next row (instead of submitting
  // the whole form) and moves focus into it — fast entry for long lists.
  const onIngredientKeyDown = (idx: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    ingredients.insert(idx + 1, { name: '', quantity: '', unit: '' })
    setTimeout(() => form.setFocus(`ingredients.${idx + 1}.quantity`), 0)
  }

  const save = useMutation({
    mutationFn: (payload: RecipeCreate | RecipeUpdate) =>
      isEdit ? api.updateRecipe(recipeId, payload) : api.createRecipe(payload as RecipeCreate),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.invalidateQueries({ queryKey: ['recipe', saved.id] })
      // After creating, land on the editor so photos/videos can be added.
      navigate(isEdit ? `/recipes/${saved.id}` : `/recipes/${saved.id}/edit`)
    },
  })

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    )
  }

  const onSubmit = form.handleSubmit((v) => save.mutate(toPayload(v)))
  const { errors } = form.formState
  const backHref = isEdit ? `/recipes/${recipeId}` : '/'

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to={backHref}>
            <ArrowLeft /> Back
          </Link>
        </Button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {isEdit ? 'Edit' : 'New recipe'}
        </p>
        <h1 className="text-display font-semibold">
          {isEdit ? (recipe?.title ?? 'Edit recipe') : 'Create a recipe'}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Section title="The basics">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register('title')} placeholder="Grandma's tomato pasta" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="A few words about this dish…"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="servings">Servings</Label>
              <Input id="servings" inputMode="numeric" {...form.register('servings')} />
              {errors.servings && (
                <p className="text-sm text-destructive">{errors.servings.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="prep">Prep (min)</Label>
              <Input id="prep" inputMode="numeric" {...form.register('prep_time_min')} />
              {errors.prep_time_min && (
                <p className="text-sm text-destructive">{errors.prep_time_min.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cook">Cook (min)</Label>
              <Input id="cook" inputMode="numeric" {...form.register('cook_time_min')} />
              {errors.cook_time_min && (
                <p className="text-sm text-destructive">{errors.cook_time_min.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" {...form.register('tags')} placeholder="dinner, vegetarian, quick" />
            <p className="text-xs text-muted-foreground">Comma-separated.</p>
            {tagsQuery.data && tagsQuery.data.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tagsQuery.data.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addTag(t.name)}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    + {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Ingredients">
          <ul className="space-y-2">
            {ingredients.fields.map((f, idx) => (
              <li key={f.id} className="flex gap-2">
                <Input
                  placeholder="Qty"
                  className="w-20"
                  onKeyDown={onIngredientKeyDown(idx)}
                  {...form.register(`ingredients.${idx}.quantity`)}
                />
                <Input
                  placeholder="Unit"
                  className="w-24"
                  onKeyDown={onIngredientKeyDown(idx)}
                  {...form.register(`ingredients.${idx}.unit`)}
                />
                <Input
                  placeholder="Ingredient"
                  onKeyDown={onIngredientKeyDown(idx)}
                  {...form.register(`ingredients.${idx}.name`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove ingredient"
                  onClick={() => ingredients.remove(idx)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => ingredients.append({ name: '', quantity: '', unit: '' })}
            >
              <Plus /> Add ingredient
            </Button>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Enter adds the next ingredient.
            </p>
          </div>
        </Section>

        <Section title="Steps">
          <ol className="space-y-2">
            {steps.fields.map((f, idx) => (
              <li key={f.id} className="flex gap-2">
                <span className="num mt-2.5 w-5 shrink-0 text-right text-sm text-muted-foreground">
                  {idx + 1}.
                </span>
                <Textarea
                  rows={2}
                  placeholder="Describe this step…"
                  {...form.register(`steps.${idx}.instruction`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove step"
                  onClick={() => steps.remove(idx)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => steps.append({ instruction: '' })}
          >
            <Plus /> Add step
          </Button>
        </Section>

        {/* Floating save bar: the primary action stays in reach on long forms. */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-lift backdrop-blur">
          <p className="min-w-0 flex-1 truncate text-sm text-destructive">
            {save.isError ? (save.error as Error).message : ''}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild type="button" variant="ghost">
              <Link to={backHref}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create recipe'}
            </Button>
          </div>
        </div>
      </form>

      {isEdit && recipe ? (
        <Section title="Photos & video">
          <MediaManager recipe={recipe} />
        </Section>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Save the recipe first, then you can add photos and videos.
        </p>
      )}
    </div>
  )
}
