// Typed client for the hometable API (mirrors backend Pydantic schemas).

export type MediaType = 'image' | 'video'
export type MediaSource = 'upload' | 'embed'
export type MediaStatus = 'pending' | 'ready'

export interface Media {
  id: number
  media_type: MediaType
  source: MediaSource
  status: MediaStatus
  url: string | null
  provider: string | null
  thumbnail_url: string | null
  position: number
}

export interface Ingredient {
  id: number
  name: string
  quantity: string | null
  unit: string | null
  position: number
}

export interface Step {
  id: number
  instruction: string
  position: number
}

export interface Tag {
  id: number
  name: string
  kind: string
}

export interface Recipe {
  id: number
  title: string
  description: string | null
  servings: number | null
  prep_time_min: number | null
  cook_time_min: number | null
  cover_media_id: number | null
  cover_url: string | null
  ingredients: Ingredient[]
  steps: Step[]
  media: Media[]
  tags: Tag[]
  created_at: string
  updated_at: string
}

export interface RecipeListItem {
  id: number
  title: string
  description: string | null
  cover_url: string | null
  servings: number | null
  total_time_min: number | null
  tags: Tag[]
}

export interface IngredientInput {
  name: string
  quantity?: string | null
  unit?: string | null
}

export interface StepInput {
  instruction: string
}

export interface RecipeCreate {
  title: string
  description?: string | null
  servings?: number | null
  prep_time_min?: number | null
  cook_time_min?: number | null
  ingredients?: IngredientInput[]
  steps?: StepInput[]
  tags?: string[]
}

export type RecipeUpdate = Partial<RecipeCreate> & { cover_media_id?: number | null }

export interface MediaInit {
  media: Media
  upload_url: string | null
}

const BASE = '/api/v1'

async function http<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
  if (!res.ok) {
    let detail: string = res.statusText
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // response had no JSON body; keep statusText
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface ListParams {
  q?: string
  tag?: string[]
  limit?: number
  offset?: number
}

export const api = {
  listRecipes: (p: ListParams = {}) => {
    const qs = new URLSearchParams()
    if (p.q) qs.set('q', p.q)
    if (p.limit) qs.set('limit', String(p.limit))
    if (p.offset) qs.set('offset', String(p.offset))
    for (const t of p.tag ?? []) qs.append('tag', t)
    const s = qs.toString()
    return http<RecipeListItem[]>(`/recipes${s ? `?${s}` : ''}`)
  },
  getRecipe: (id: number) => http<Recipe>(`/recipes/${id}`),
  createRecipe: (body: RecipeCreate) =>
    http<Recipe>('/recipes', { method: 'POST', body: JSON.stringify(body) }),
  updateRecipe: (id: number, body: RecipeUpdate) =>
    http<Recipe>(`/recipes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRecipe: (id: number) => http<void>(`/recipes/${id}`, { method: 'DELETE' }),
  listTags: () => http<Tag[]>('/tags'),

  // media
  initMedia: (
    recipeId: number,
    body: { source: MediaSource; media_type: MediaType; content_type?: string; url?: string },
  ) => http<MediaInit>(`/recipes/${recipeId}/media`, { method: 'POST', body: JSON.stringify(body) }),
  completeMedia: (recipeId: number, mediaId: number) =>
    http<Media>(`/recipes/${recipeId}/media/${mediaId}/complete`, { method: 'POST' }),
  reorderMedia: (recipeId: number, mediaId: number, position: number) =>
    http<Media>(`/recipes/${recipeId}/media/${mediaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ position }),
    }),
  deleteMedia: (recipeId: number, mediaId: number) =>
    http<void>(`/recipes/${recipeId}/media/${mediaId}`, { method: 'DELETE' }),
}

// Upload bytes straight to the object store using the presigned PUT URL.
export async function uploadToPresignedUrl(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
}
