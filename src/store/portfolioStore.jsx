import { createContext, useContext, useReducer, useEffect } from 'react'

const STORAGE_KEY = 'portfolio-tracker-v1'

// ─── Seed data ────────────────────────────────────────────────────────────────
const DEFAULT_FUNDS = [
  { id: 'nifty50',        name: 'Nifty 50',           targetPct: 30, currentValue: 0 },
  { id: 'midcap',         name: 'Mid Cap',             targetPct: 15, currentValue: 0 },
  { id: 'smallcap',       name: 'Small Cap',           targetPct: 20, currentValue: 0 },
  { id: 'liquid',         name: 'Liquid Fund',         targetPct: 10, currentValue: 0 },
  { id: 'gold',           name: 'Gold',                targetPct: 5,  currentValue: 0 },
  { id: 'ustech',         name: 'US Tech Fund',        targetPct: 10, currentValue: 0 },
  { id: 'chinafund',      name: 'Greater China Fund',  targetPct: 5,  currentValue: 0 },
  { id: 'stocks',         name: 'Individual Stocks',   targetPct: 5,  currentValue: 0 },
]

const DEFAULT_STATE = {
  funds: DEFAULT_FUNDS,
  history: [],          // [{ timestamp, funds: snapshot[], totalValue }]
  currency: 'INR',
  carryOver: 0,
  weeklyAmount: 200,    // Default weekly investment amount in INR
  weeklyInvestments: {}, // { [cycleKey]: { timestamp, amount, allocations } }
  mfData: {},           // { [fundIdOrName]: factSheetAnalysisObject }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save to localStorage', e)
  }
}

function generateId() {
  return `fund_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ─── MF Data Smart Merge Helpers ──────────────────────────────────────────────
function isEmptySlot(val) {
  if (val === null || val === undefined) return true
  if (typeof val === 'string' && val.trim() === '') return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

export function hasEmptySlots(data) {
  if (!data) return true
  // Core scalar fields every fact sheet should have
  const scalarFields = [
    'aum_in_crores', 'ter_direct_percentage', 'ter_regular_percentage',
    'cash_level_percentage', 'top_10_concentration_percentage',
    'cost_and_size_verdict',
  ]
  for (const field of scalarFields) {
    if (isEmptySlot(data[field])) return true
  }
  // Array fields that should be populated
  const arrayFields = ['top_holdings', 'sector_allocation', 'fund_managers']
  for (const field of arrayFields) {
    if (isEmptySlot(data[field])) return true
  }
  // Returns: at least 3Y or 5Y fund CAGR should exist
  const rc = data.returns_comparison
  if (!rc) return true
  if (isEmptySlot(rc.three_year?.fund_cagr) && isEmptySlot(rc.five_year?.fund_cagr)) return true
  // Risk: at least Sharpe or Beta should exist
  const rm = data.risk_metrics
  if (!rm) return true
  if (isEmptySlot(rm.sharpe_ratio) && isEmptySlot(rm.beta)) return true
  return false
}

function deepMergeMfData(existing, incoming) {
  const merged = { ...existing }
  for (const key of Object.keys(incoming)) {
    if (key === 'lastUpdated') continue
    const existingVal = existing[key]
    const incomingVal = incoming[key]
    // diagnostic_flags: concatenate and deduplicate by title
    if (key === 'diagnostic_flags') {
      const ef = Array.isArray(existingVal) ? existingVal : []
      const nf = Array.isArray(incomingVal) ? incomingVal : []
      const titles = new Set(ef.map(f => f.title))
      merged[key] = [...ef, ...nf.filter(f => !titles.has(f.title))]
      continue
    }
    // Empty existing slot → fill from incoming
    if (isEmptySlot(existingVal)) {
      if (!isEmptySlot(incomingVal)) {
        merged[key] = incomingVal
      }
    // Both are plain objects → recurse deeper
    } else if (
      typeof existingVal === 'object' && !Array.isArray(existingVal) &&
      typeof incomingVal === 'object' && incomingVal !== null && !Array.isArray(incomingVal)
    ) {
      merged[key] = deepMergeMfData(existingVal, incomingVal)
    }
    // Otherwise existing is populated → keep it
  }
  return merged
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'SET_FUNDS':
      return { ...state, funds: action.funds }

    case 'UPDATE_FUND': {
      const funds = state.funds.map(f =>
        f.id === action.id ? { ...f, ...action.changes } : f
      )
      return { ...state, funds }
    }

    case 'ADD_TO_FUND': {
      const amount = Number(action.amount) || 0
      const funds = state.funds.map(f =>
        f.id === action.id ? { ...f, currentValue: Math.max(0, (f.currentValue || 0) + amount) } : f
      )
      const totalValue = funds.reduce((s, f) => s + (f.currentValue || 0), 0)
      const snapshot = {
        timestamp: new Date().toISOString(),
        funds: funds.map(f => ({
          id: f.id,
          name: f.name,
          currentValue: f.currentValue,
          targetPct: f.targetPct,
        })),
        totalValue,
      }
      return {
        ...state,
        funds,
        history: [...state.history, snapshot],
      }
    }

    case 'ADD_FUND': {
      const newFund = {
        id: generateId(),
        name: 'New Fund',
        targetPct: 0,
        currentValue: 0,
      }
      return { ...state, funds: [...state.funds, newFund] }
    }

    case 'REMOVE_FUND': {
      const funds = state.funds.filter(f => f.id !== action.id)
      return { ...state, funds }
    }

    case 'APPLY_ALLOCATION': {
      const funds = state.funds.map(f => ({
        ...f,
        currentValue: f.currentValue + (action.allocations[f.id] || 0),
      }))
      const totalValue = funds.reduce((s, f) => s + f.currentValue, 0)
      const snapshot = {
        timestamp: new Date().toISOString(),
        funds: funds.map(f => ({
          id: f.id,
          name: f.name,
          currentValue: f.currentValue,
          targetPct: f.targetPct,
        })),
        totalValue,
      }
      const updatedWeeklyInvestments = { ...(state.weeklyInvestments || {}) }
      if (action.cycleKey) {
        updatedWeeklyInvestments[action.cycleKey] = {
          timestamp: new Date().toISOString(),
          amount: action.amount || 200,
          allocations: action.allocations,
        }
      }
      return {
        ...state,
        funds,
        history: [...state.history, snapshot],
        carryOver: action.carryOver ?? state.carryOver,
        weeklyInvestments: updatedWeeklyInvestments,
      }
    }

    case 'SET_WEEKLY_AMOUNT':
      return { ...state, weeklyAmount: Math.max(100, Number(action.amount) || 200) }

    case 'RESET_CYCLE_INVESTMENT': {
      const updatedWeeklyInvestments = { ...(state.weeklyInvestments || {}) }
      if (action.cycleKey) {
        delete updatedWeeklyInvestments[action.cycleKey]
      }
      return { ...state, weeklyInvestments: updatedWeeklyInvestments }
    }

    case 'SAVE_SNAPSHOT': {
      const totalValue = state.funds.reduce((s, f) => s + f.currentValue, 0)
      const snapshot = {
        timestamp: new Date().toISOString(),
        funds: state.funds.map(f => ({
          id: f.id,
          name: f.name,
          currentValue: f.currentValue,
          targetPct: f.targetPct,
        })),
        totalValue,
      }
      return { ...state, history: [...state.history, snapshot] }
    }

    case 'SET_CARRY_OVER':
      return { ...state, carryOver: action.amount }

    case 'SAVE_MF_DATA': {
      const { fundKey, data } = action
      const existingData = (state.mfData || {})[fundKey]

      let newData
      if (existingData && hasEmptySlots(existingData)) {
        // Merge: existing data has gaps → fill them with new analysis
        newData = {
          ...deepMergeMfData(existingData, data),
          lastUpdated: new Date().toISOString(),
        }
      } else {
        // No existing data OR fully populated (new month) → overwrite
        newData = {
          ...data,
          lastUpdated: new Date().toISOString(),
        }
      }

      return {
        ...state,
        mfData: {
          ...(state.mfData || {}),
          [fundKey]: newData,
        },
      }
    }

    case 'CLEAR_MF_DATA': {
      const { fundKey } = action
      const newMfData = { ...(state.mfData || {}) }
      delete newMfData[fundKey]
      return {
        ...state,
        mfData: newMfData
      }
    }

    case 'IMPORT_STATE':
      return { 
        ...DEFAULT_STATE, 
        ...action.state,
        mfData: action.state.mfData || {}
      }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const PortfolioContext = createContext(null)

export function PortfolioProvider({ children }) {
  const saved = loadFromStorage()
  const [state, dispatch] = useReducer(reducer, saved ?? DEFAULT_STATE)

  // Persist on every state change
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  return (
    <PortfolioContext.Provider value={{ state, dispatch }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider')
  return ctx
}

// ─── Export / Import helpers ──────────────────────────────────────────────────
export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJSON(file, dispatch) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result)
      dispatch({ type: 'IMPORT_STATE', state: parsed })
      alert('Data imported successfully!')
    } catch {
      alert('Invalid JSON file.')
    }
  }
  reader.readAsText(file)
}
