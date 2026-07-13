import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { OfflineIndicator } from './OfflineIndicator'

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
