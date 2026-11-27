import { Outlet } from 'react-router'
import Sidebar from './Sidebar'

function Layout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
