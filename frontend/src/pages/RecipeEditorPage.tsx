import { Link, useParams } from 'react-router-dom'

export function RecipeEditorPage() {
  const { id } = useParams()
  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-muted-foreground underline">
        ← All recipes
      </Link>
      <h1 className="font-serif text-3xl font-bold">{id ? 'Edit recipe' : 'New recipe'}</h1>
      <p className="text-muted-foreground">
        The recipe editor (with photo &amp; video upload) arrives in the next iteration.
      </p>
    </div>
  )
}
