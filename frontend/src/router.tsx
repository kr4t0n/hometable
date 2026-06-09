import { createBrowserRouter } from 'react-router-dom'

import { Layout } from '@/components/Layout'
import { MealDetailPage } from '@/pages/MealDetailPage'
import { MealShoppingListPage } from '@/pages/MealShoppingListPage'
import { MealsListPage } from '@/pages/MealsListPage'
import { RecipeDetailPage } from '@/pages/RecipeDetailPage'
import { RecipeEditorPage } from '@/pages/RecipeEditorPage'
import { RecipeListPage } from '@/pages/RecipeListPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <RecipeListPage /> },
      { path: '/recipes/new', element: <RecipeEditorPage /> },
      { path: '/recipes/:id', element: <RecipeDetailPage /> },
      { path: '/recipes/:id/edit', element: <RecipeEditorPage /> },
      { path: '/shopping-list', element: <MealShoppingListPage /> },
      { path: '/meals', element: <MealsListPage /> },
      { path: '/meals/:id', element: <MealDetailPage /> },
    ],
  },
])
