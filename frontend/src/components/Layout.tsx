import { ChefHat, Moon, Plus, Sun } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'

export function Layout() {
  const { theme, toggle } = useTheme()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md print:hidden">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="group inline-flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform duration-300 group-hover:-rotate-6">
                <ChefHat className="size-5" />
              </span>
              <span className="font-serif text-xl font-semibold tracking-tight">hometable</span>
            </Link>
            <nav className="flex items-center gap-1">
              {(
                [
                  ['/', 'Recipes'],
                  ['/meals', 'Meals'],
                ] as const
              ).map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button asChild>
              <Link to="/recipes/new">
                <Plus />
                <span className="hidden sm:inline">New recipe</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-10">
        <Outlet />
      </main>

      <footer className="border-t print:hidden">
        <div className="container flex h-14 items-center justify-between text-xs text-muted-foreground">
          <span>hometable — your kitchen, collected.</span>
          <span className="font-serif italic">made at home</span>
        </div>
      </footer>
    </div>
  )
}
