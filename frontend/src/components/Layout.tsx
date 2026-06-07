import { ChefHat, Moon, Plus, Sun } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'

export function Layout() {
  const { theme, toggle } = useTheme()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChefHat className="size-5" />
            </span>
            <span className="font-serif text-xl font-semibold">hometable</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button asChild>
              <Link to="/recipes/new">
                <Plus /> New recipe
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  )
}
