import { useState } from 'react'
import { PortfolioProvider } from './store/portfolioStore'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Allocator from './pages/Allocator'
import FactSheets from './pages/FactSheets'
import AiAnalyzer from './pages/AiAnalyzer'
import MfData from './pages/MfData'

function AppContent() {
  const [activePage, setActivePage] = useState('dashboard')
  const [targetFundForMfData, setTargetFundForMfData] = useState(null)
  const [targetFundForAnalyzer, setTargetFundForAnalyzer] = useState(null)

  const handleNavigateToMfData = (fundKey) => {
    setTargetFundForMfData(fundKey)
    setActivePage('mfdata')
  }

  const handleNavigateToAnalyzer = (fundName) => {
    setTargetFundForAnalyzer(fundName)
    setActivePage('aianalyzer')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] text-white bg-grid-pattern">
      <Navbar activePage={activePage} setActivePage={setActivePage} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">
        {activePage === 'dashboard'  && <Dashboard />}
        {activePage === 'allocator'  && <Allocator />}
        {activePage === 'factsheets' && <FactSheets />}
        {activePage === 'aianalyzer' && (
          <AiAnalyzer 
            onNavigateToMfData={handleNavigateToMfData}
            preselectedFund={targetFundForAnalyzer}
          />
        )}
        {activePage === 'mfdata'     && (
          <MfData 
            initialFundId={targetFundForMfData}
            onNavigateToAnalyzer={handleNavigateToAnalyzer}
          />
        )}
      </main>

      <footer className="border-t border-neutral-850 bg-black py-6 text-center text-xs font-mono text-neutral-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            <span className="text-white font-bold uppercase tracking-wider text-xs">PORTFOLIO TRACKER</span>
            <span className="text-neutral-500">// Local Storage Edition</span>
          </div>
          <p className="text-neutral-400 text-xs">
            All data stored locally in your browser · Zero cloud dependencies · Automatic snapshot history
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <PortfolioProvider>
      <AppContent />
    </PortfolioProvider>
  )
}
