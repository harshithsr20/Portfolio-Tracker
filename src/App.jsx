import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, logoutUser } from './lib/firebase'
import { PortfolioProvider, usePortfolio } from './store/portfolioStore'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Allocator from './pages/Allocator'
import FactSheets from './pages/FactSheets'
import AiAnalyzer from './pages/AiAnalyzer'
import MfData from './pages/MfData'
import FundSetup from './pages/FundSetup'
import Login from './pages/Login'

function AppContent({ user }) {
  const { state } = usePortfolio()
  const { funds } = state
  const [activePage, setActivePage] = useState('dashboard')
  const [targetFundForMfData, setTargetFundForMfData] = useState(null)
  const [targetFundForAnalyzer, setTargetFundForAnalyzer] = useState(null)
  const [hasCheckedNewUser, setHasCheckedNewUser] = useState(false)

  // Redirect to Fund Setup if new user (no funds)
  useEffect(() => {
    if (!hasCheckedNewUser) {
      if (funds.length === 0) {
        setActivePage('fundsetup')
      }
      setHasCheckedNewUser(true)
    }
  }, [funds.length, hasCheckedNewUser])

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
        {activePage === 'fundsetup'  && <FundSetup />}
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
            <span className="text-neutral-500">// Firebase Edition</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-neutral-400 text-xs">
              Logged in as: {user.email}
            </span>
            <button onClick={logoutUser} className="text-rose-400 hover:text-rose-300 underline">
              Logout
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-white">
        <div className="animate-pulse font-mono text-neutral-400 text-sm">Initializing Firebase Auth...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <PortfolioProvider user={user}>
      <AppContent user={user} />
    </PortfolioProvider>
  )
}
