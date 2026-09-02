import { createContext, useContext, useReducer, useEffect, useState } from 'react'

const STORAGE_KEY = 'portfolio-tracker-v1'

// ─── Seed data ────────────────────────────────────────────────────────────────
const DEFAULT_FUNDS = [
  { id: 'nifty50',        name: 'Nifty 50',           targetPct: 35, currentValue: 0 },
  { id: 'midcap',         name: 'Mid Cap',             targetPct: 20, currentValue: 0 },
  { id: 'smallcap',       name: 'Small Cap',           targetPct: 20, currentValue: 0 },
  { id: 'liquid',         name: 'Liquid Fund',         targetPct: 10, currentValue: 0 },
  { id: 'gold',           name: 'Gold',                targetPct: 5,  currentValue: 0 },
  { id: 'stocks',         name: 'Individual Stocks',   targetPct: 10, currentValue: 0 },
]

export function sanitizeFunds(funds) {
  if (!Array.isArray(funds) || funds.length === 0) return DEFAULT_FUNDS
  // Filter out closed funds (US Tech, China)
  const filtered = funds.filter(f => {
    const id = (f.id || '').toLowerCase()
    const name = (f.name || '').toLowerCase()
    return id !== 'ustech' && id !== 'chinafund' && 
           !name.includes('china') && !name.includes('us tech') && !name.includes('us technology')
  })

  return filtered.map(f => {
    if (f.id === 'nifty50' && f.targetPct === 30) return { ...f, targetPct: 35 }
    if (f.id === 'midcap' && f.targetPct === 15) return { ...f, targetPct: 20 }
    if (f.id === 'stocks' && f.targetPct === 5) return { ...f, targetPct: 10 }
    return f
  })
}

const DEFAULT_STATE = {
  funds: DEFAULT_FUNDS,
  history: [],          // [{ timestamp, funds: snapshot[], totalValue }]
  currency: 'INR',
  carryOver: 0,
  weeklyAmount: 200,    // Default weekly investment amount in INR
  minLot: 100,          // Default min lot in INR
  lastModified: Date.now(),
  weeklyInvestments: {}, // { [cycleKey]: { timestamp, amount, allocations } }
  mfData: {},           // { [fundIdOrName]: factSheetAnalysisObject }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.funds) {
      parsed.funds = sanitizeFunds(parsed.funds)
    }
    return parsed
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

async function fetchFromFirebase(userId) {
  if (!db) return null;
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch from Firebase', e);
    return null;
  }
}

async function saveToFirebase(userId, state) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', userId), state);
  } catch (e) {
    console.error('Failed to save to Firebase', e);
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
      return { ...state, funds: action.funds, lastModified: Date.now() }

    case 'UPDATE_FUND': {
      const funds = state.funds.map(f =>
        f.id === action.id ? { ...f, ...action.changes } : f
      )
      return { ...state, funds, lastModified: Date.now() }
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
        lastModified: Date.now(),
      }
    }

    case 'ADD_FUND': {
      const newFund = {
        id: generateId(),
        name: 'New Fund',
        targetPct: 0,
        currentValue: 0,
      }
      return { ...state, funds: [...state.funds, newFund], lastModified: Date.now() }
    }

    case 'REMOVE_FUND': {
      const funds = state.funds.filter(f => f.id !== action.id)
      return { ...state, funds, lastModified: Date.now() }
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
        lastModified: Date.now(),
      }
    }

    case 'SET_WEEKLY_AMOUNT':
      return { ...state, weeklyAmount: Math.max(100, Number(action.amount) || 200), lastModified: Date.now() }

    case 'SET_MIN_LOT':
      return { ...state, minLot: Math.max(10, Number(action.minLot) || 100), lastModified: Date.now() }

    case 'RESET_CYCLE_INVESTMENT': {
      const updatedWeeklyInvestments = { ...(state.weeklyInvestments || {}) }
      if (action.cycleKey) {
        delete updatedWeeklyInvestments[action.cycleKey]
      }
      return { ...state, weeklyInvestments: updatedWeeklyInvestments, lastModified: Date.now() }
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
      return { ...state, history: [...state.history, snapshot], lastModified: Date.now() }
    }

    case 'SET_CARRY_OVER':
      return { ...state, carryOver: action.amount, lastModified: Date.now() }

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
        funds: action.state?.funds ? sanitizeFunds(action.state.funds) : DEFAULT_FUNDS,
        minLot: action.state?.minLot || 100,
        weeklyAmount: action.state?.weeklyAmount || 200,
        mfData: action.state?.mfData || {},
        lastModified: Date.now(),
      }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const PortfolioContext = createContext(null)

export function PortfolioProvider({ children, user }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE)
  const [isReady, setIsReady] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 1. Initial Load from Firebase (or migrate from localStorage)
  useEffect(() => {
    async function initData() {
      if (!user) return;
      setIsReady(false);
      const fbData = await fetchFromFirebase(user.uid);
      
      if (fbData) {
        // User has data in Firebase, use it
        dispatch({ type: 'IMPORT_STATE', state: fbData });
      } else {
        // No data in Firebase. 
        // If this is the specific migration user AND local storage has data, migrate it.
        const localData = loadFromStorage();
        if (user.email === 'harshithsr20@gmail.com' && localData) {
          console.log('Migrating local data to Firebase for harshithsr20@gmail.com');
          dispatch({ type: 'IMPORT_STATE', state: localData });
        } else if (localData) {
          // Alternatively, always migrate local data to a new user account?
          // We will do it for everyone just to be nice, but explicitly handling it.
          dispatch({ type: 'IMPORT_STATE', state: localData });
        }
      }
      setIsReady(true);
    }
    initData();
  }, [user]);

  // 2. Persist on every state change (after ready)
  useEffect(() => {
    if (isReady && user) {
      saveToFirebase(user.uid, state);
      // Also save to local storage as a fallback/cache
      saveToStorage(state);
    }
  }, [state, isReady, user])

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-white">
        <div className="animate-pulse text-sm font-mono text-neutral-400">Loading Portfolio Data...</div>
      </div>
    )
  }

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
