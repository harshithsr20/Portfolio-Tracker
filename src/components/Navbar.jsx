import { usePortfolio, exportJSON, importJSON } from '../store/portfolioStore'
import { useRef } from 'react'

const tabs = [
  { id: 'dashboard',  label: 'Dashboard',   code: '01' },
  { id: 'allocator',  label: 'Allocator',   code: '02' },
  { id: 'factsheets', label: 'Fact Sheets', code: '03' },
  { id: 'aianalyzer', label: 'AI Analyzer', code: '04' },
  { id: 'mfdata',     label: 'MF Data',     code: '05' }
]

export default function Navbar({ activePage, setActivePage }) {
  const { state, dispatch } = usePortfolio()
  const fileRef = useRef(null)

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (file) importJSON(file, dispatch)
    e.target.value = ''
  }

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
        
        {/* Brand: PORTFOLIO TRACKER */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white text-black font-mono font-black text-base tracking-tight shadow-md">
            //
          </div>
          <div>
            <h1 className="font-display font-extrabold text-lg sm:text-xl tracking-wide text-white uppercase">
              PORTFOLIO TRACKER
            </h1>
            <p className="text-xs font-mono text-neutral-400">
              Personal Asset Allocation Engine
            </p>
          </div>
        </div>

        {/* Center Tabs: Dashboard & Allocator */}
        <nav className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800 shadow-inner">
          {tabs.map(t => (
            <button
              key={t.id}
              id={`nav-${t.id}`}
              onClick={() => setActivePage(t.id)}
              className={`ather-tab ${activePage === t.id ? 'ather-tab-active' : 'ather-tab-inactive'}`}
            >
              <span className={`text-xs ${activePage === t.id ? 'text-neutral-600' : 'text-neutral-500'}`}>
                {t.code}
              </span>
              <span className="font-bold">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-export"
            onClick={() => exportJSON(state)}
            className="ather-btn-ghost"
            title="Backup JSON file"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-xs font-bold">Export Backup</span>
          </button>

          <button
            id="btn-import"
            onClick={() => fileRef.current?.click()}
            className="ather-btn-ghost"
            title="Restore from JSON"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-xs font-bold">Import Backup</span>
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>

      </div>
    </header>
  )
}
