import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import Sidebar from '@/components/Sidebar'
import GeneratePage from '@/pages/GeneratePage'
import HistoryPage from '@/pages/HistoryPage'
import StatsPage from '@/pages/StatsPage'

type Page = 'generate' | 'history' | 'stats'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('generate')

  const renderPage = () => {
    switch (currentPage) {
      case 'generate': return <GeneratePage />
      case 'history':  return <HistoryPage />
      case 'stats':    return <StatsPage />
      default:         return <GeneratePage />
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-dark-950">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full p-6 lg:p-8">
            {renderPage()}
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
