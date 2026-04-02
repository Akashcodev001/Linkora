import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,var(--brand-light),transparent_40%),radial-gradient(circle_at_bottom_right,var(--bg-hover),transparent_45%)]" />
      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default AppShell
