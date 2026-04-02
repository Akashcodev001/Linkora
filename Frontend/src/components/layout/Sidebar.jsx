import { NavLink } from 'react-router-dom'
import { Folder, Home, Network, Search, Shield, Sparkles } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/cn'
import Highlighter from '@/components/ui/Highlighter'
import { useAuth } from '@/hooks/useAuth'

const baseNavItems = [
  { label: 'Dashboard', to: ROUTES.DASHBOARD, icon: Home },
  { label: 'Search', to: ROUTES.SEARCH, icon: Search },
  { label: 'Collections', to: ROUTES.COLLECTIONS, icon: Folder },
  { label: 'Graph', to: ROUTES.GRAPH, icon: Network },
  { label: 'Resurfacing', to: ROUTES.RESURFACING, icon: Sparkles },
]

export function Sidebar() {
  const { user } = useAuth()
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'
  const navItems = [
    ...baseNavItems,
    ...(isAdmin ? [{ label: 'Admin', to: ROUTES.ADMIN, icon: Shield }] : []),
  ]

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/80 bg-bg-surface/90 p-4 backdrop-blur md:block">
      <div className="mb-6 px-2">
        <h1 className="text-xl font-bold text-brand">
          <Highlighter action="underline" color="#FF9800" animationDuration={850} iterations={1} isView>
            Linkora
          </Highlighter>
        </h1>
        <p className="text-xs text-text-muted">Knowledge OS</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-default px-3 py-2 text-sm text-text-secondary transition-all hover:translate-x-0.5 hover:bg-bg-hover',
                  isActive && 'bg-brand-light text-brand-dark shadow-subtle',
                )
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
