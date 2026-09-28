import { useState, useMemo } from 'react'
import { usePortfolio } from '../store/portfolioStore'
import { enrichFunds, formatCurrency, computeTargetSum, computeTotalValue } from '../utils/portfolio'

export default function CategoryAllocationAdjuster({
  onClose,
  isModal = false,
  title = "Category Target Allocation Calibrator",
  subtitle = "Adjust and fine-tune target percentages allocated to each asset category."
}) {
  const { state, dispatch } = usePortfolio()
  const { funds = [] } = state
  const enriched = enrichFunds(funds)
  const totalValue = computeTotalValue(funds)

  const [lockedFunds, setLockedFunds] = useState({}) // { [fundId]: true }
  const [activePreset, setActivePreset] = useState('')

  const targetSum = computeTargetSum(funds)
  const isBalanced = Math.abs(targetSum - 100) < 0.01
  const remainder = Number((100 - targetSum).toFixed(2))

  // Toggle lock state for a fund
  const toggleLock = (fundId) => {
    setLockedFunds(prev => ({
      ...prev,
      [fundId]: !prev[fundId]
    }))
  }

  // Update a single fund target percentage
  const handleTargetChange = (id, newPct) => {
    const val = Math.max(0, Math.min(100, parseFloat(newPct) || 0))
    dispatch({
      type: 'UPDATE_FUND',
      id,
      changes: { targetPct: parseFloat(val.toFixed(2)) }
    })
    setActivePreset('')
  }

  // Quick increment/decrement
  const handleStep = (id, currentVal, delta) => {
    const nextVal = Math.max(0, Math.min(100, (Number(currentVal) || 0) + delta))
    handleTargetChange(id, nextVal)
  }

  // Auto-Balance: assign remaining gap to unlocked funds
  const handleAutoBalance = () => {
    if (funds.length === 0) return
    const unlocked = funds.filter(f => !lockedFunds[f.id])
    if (unlocked.length === 0) return

    // If remainder > 0, give it to the last unlocked fund or distribute
    if (remainder > 0) {
      const targetFund = unlocked[unlocked.length - 1]
      const newPct = Number((Number(targetFund.targetPct || 0) + remainder).toFixed(2))
      dispatch({
        type: 'UPDATE_FUND',
        id: targetFund.id,
        changes: { targetPct: Math.max(0, newPct) }
      })
    } else if (remainder < 0) {
      // If over 100%, normalize unlocked funds
      handleNormalize()
    }
  }

  // Normalize all unlocked funds so total target is exactly 100%
  const handleNormalize = () => {
    if (funds.length === 0) return
    const lockedTotal = funds
      .filter(f => lockedFunds[f.id])
      .reduce((s, f) => s + (Number(f.targetPct) || 0), 0)
    
    const availableTotal = Math.max(0, 100 - lockedTotal)
    const unlockedFunds = funds.filter(f => !lockedFunds[f.id])
    const currentUnlockedSum = unlockedFunds.reduce((s, f) => s + (Number(f.targetPct) || 0), 0)

    if (unlockedFunds.length === 0) return

    const newTargets = {}
    if (currentUnlockedSum === 0) {
      const equalShare = Number((availableTotal / unlockedFunds.length).toFixed(2))
      unlockedFunds.forEach((f, idx) => {
        if (idx === unlockedFunds.length - 1) {
          const others = equalShare * (unlockedFunds.length - 1)
          newTargets[f.id] = Number((availableTotal - others).toFixed(2))
        } else {
          newTargets[f.id] = equalShare
        }
      })
    } else {
      let accumulated = 0
      unlockedFunds.forEach((f, idx) => {
        if (idx === unlockedFunds.length - 1) {
          newTargets[f.id] = Number(Math.max(0, availableTotal - accumulated).toFixed(2))
        } else {
          const ratio = (Number(f.targetPct) || 0) / currentUnlockedSum
          const scaled = Number((ratio * availableTotal).toFixed(2))
          accumulated += scaled
          newTargets[f.id] = scaled
        }
      })
    }

    dispatch({ type: 'SET_TARGET_PERCENTAGES', targets: newTargets })
  }

  // Equalize unlocked funds
  const handleEqualSplit = () => {
    if (funds.length === 0) return
    const lockedTotal = funds
      .filter(f => lockedFunds[f.id])
      .reduce((s, f) => s + (Number(f.targetPct) || 0), 0)
    
    const availableTotal = Math.max(0, 100 - lockedTotal)
    const unlockedFunds = funds.filter(f => !lockedFunds[f.id])
    if (unlockedFunds.length === 0) return

    const equalShare = Number((availableTotal / unlockedFunds.length).toFixed(2))
    const newTargets = {}
    let running = 0

    unlockedFunds.forEach((f, idx) => {
      if (idx === unlockedFunds.length - 1) {
        newTargets[f.id] = Number(Math.max(0, availableTotal - running).toFixed(2))
      } else {
        newTargets[f.id] = equalShare
        running += equalShare
      }
    })

    dispatch({ type: 'SET_TARGET_PERCENTAGES', targets: newTargets })
    setActivePreset('equal')
  }

  // Match actual current portfolio distribution
  const handleMatchCurrentHoldings = () => {
    if (funds.length === 0 || totalValue <= 0) return
    const newTargets = {}
    let sum = 0
    funds.forEach((f, idx) => {
      if (idx === funds.length - 1) {
        newTargets[f.id] = Number(Math.max(0, 100 - sum).toFixed(2))
      } else {
        const pct = Number(((Number(f.currentValue || 0) / totalValue) * 100).toFixed(2))
        sum += pct
        newTargets[f.id] = pct
      }
    })
    dispatch({ type: 'SET_TARGET_PERCENTAGES', targets: newTargets })
    setActivePreset('match-holdings')
  }

  // Apply predefined strategic allocation presets
  const applyPreset = (presetKey) => {
    if (funds.length === 0) return
    const n = funds.length
    const newTargets = {}

    if (presetKey === 'aggressive') {
      // Heavy equity / small & mid
      funds.forEach(f => {
        const name = (f.name || '').toLowerCase()
        if (name.includes('nifty') || name.includes('large')) newTargets[f.id] = 30
        else if (name.includes('mid')) newTargets[f.id] = 35
        else if (name.includes('small')) newTargets[f.id] = 25
        else if (name.includes('gold')) newTargets[f.id] = 5
        else if (name.includes('liquid') || name.includes('debt')) newTargets[f.id] = 5
        else newTargets[f.id] = Math.max(5, Math.floor(100 / n))
      })
    } else if (presetKey === 'balanced') {
      // 60:40 balanced
      funds.forEach(f => {
        const name = (f.name || '').toLowerCase()
        if (name.includes('nifty') || name.includes('large')) newTargets[f.id] = 35
        else if (name.includes('mid')) newTargets[f.id] = 20
        else if (name.includes('small')) newTargets[f.id] = 15
        else if (name.includes('gold')) newTargets[f.id] = 10
        else if (name.includes('liquid') || name.includes('debt')) newTargets[f.id] = 20
        else newTargets[f.id] = Math.max(5, Math.floor(100 / n))
      })
    } else if (presetKey === 'conservative') {
      // Capital preservation
      funds.forEach(f => {
        const name = (f.name || '').toLowerCase()
        if (name.includes('nifty') || name.includes('large')) newTargets[f.id] = 25
        else if (name.includes('mid')) newTargets[f.id] = 15
        else if (name.includes('small')) newTargets[f.id] = 10
        else if (name.includes('gold')) newTargets[f.id] = 20
        else if (name.includes('liquid') || name.includes('debt')) newTargets[f.id] = 30
        else newTargets[f.id] = Math.max(5, Math.floor(100 / n))
      })
    } else if (presetKey === 'all-weather') {
      // Ray Dalio all weather
      funds.forEach(f => {
        const name = (f.name || '').toLowerCase()
        if (name.includes('nifty') || name.includes('large') || name.includes('stocks')) newTargets[f.id] = 30
        else if (name.includes('mid') || name.includes('small')) newTargets[f.id] = 15
        else if (name.includes('liquid') || name.includes('debt')) newTargets[f.id] = 40
        else if (name.includes('gold')) newTargets[f.id] = 15
        else newTargets[f.id] = Math.floor(100 / n)
      })
    }

    // Normalize generated targets to sum to 100
    const rawSum = Object.values(newTargets).reduce((s, v) => s + v, 0)
    if (rawSum > 0) {
      let run = 0
      const ids = Object.keys(newTargets)
      ids.forEach((id, idx) => {
        if (idx === ids.length - 1) {
          newTargets[id] = Number(Math.max(0, 100 - run).toFixed(2))
        } else {
          const scaled = Number(((newTargets[id] / rawSum) * 100).toFixed(2))
          run += scaled
          newTargets[id] = scaled
        }
      })
    }

    dispatch({ type: 'SET_TARGET_PERCENTAGES', targets: newTargets })
    setActivePreset(presetKey)
  }

  const content = (
    <div className="space-y-6">
      
      {/* Top Calibrator Header & Global Status */}
      <div className="bg-neutral-950/90 border border-neutral-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h3 className="text-white font-display font-extrabold text-lg tracking-wide uppercase">
                {title}
              </h3>
            </div>
            <p className="text-xs font-mono text-neutral-400 mt-1">
              {subtitle}
            </p>
          </div>

          {/* Allocation Health Status Pill */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`px-3.5 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-2 ${
              isBalanced
                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300 shadow-md shadow-emerald-950/40'
                : targetSum < 100
                ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300'
                : 'bg-rose-950/60 border-rose-500/80 text-rose-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-emerald-400' : targetSum < 100 ? 'bg-cyan-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`} />
              <span>TOTAL ALLOCATED: <strong className="text-white text-sm">{targetSum.toFixed(1)}%</strong> / 100.0%</span>
              {!isBalanced && (
                <span className="text-[11px] opacity-85">
                  ({targetSum < 100 ? `${remainder}% unassigned` : `${(-remainder).toFixed(1)}% excess`})
                </span>
              )}
            </div>

            {isModal && onClose && (
              <button
                onClick={onClose}
                className="ather-btn-primary py-1.5 px-4 text-xs font-mono"
              >
                Done
              </button>
            )}
          </div>
        </div>

        {/* ── Segmented Visual Allocation Bar ── */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-neutral-900 rounded-full overflow-hidden flex border border-neutral-800 shadow-inner">
            {enriched.map(f => {
              const pct = Math.max(0, Number(f.targetPct) || 0)
              if (pct <= 0) return null
              return (
                <div
                  key={f.id}
                  className="h-full transition-all duration-300 relative group cursor-pointer"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: f.color
                  }}
                  title={`${f.name}: ${pct}%`}
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-30 border border-neutral-700 shadow-lg">
                    {f.name} ({pct}%)
                  </div>
                </div>
              )
            })}
            {targetSum < 100 && (
              <div
                className="h-full bg-neutral-800/80 repeating-linear-gradient"
                style={{ width: `${Math.max(0, 100 - targetSum)}%` }}
                title={`Unallocated: ${(100 - targetSum).toFixed(1)}%`}
              />
            )}
          </div>

          {/* Mini Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-neutral-400">
            {enriched.map(f => (
              <div key={f.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: f.color }}></span>
                <span className="text-neutral-300 font-semibold">{f.name}:</span>
                <span className="text-white font-bold">{f.targetPct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Action Toolbar: Auto-Balance, Normalize, Equal Split, Presets ── */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {!isBalanced && (
              <button
                onClick={handleAutoBalance}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/80 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <span>⚡ Auto-Balance Remainder</span>
              </button>
            )}

            <button
              onClick={handleNormalize}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
              title="Scale all categories proportionately to 100%"
            >
              <span>⚖️ Proportional Normalize (100%)</span>
            </button>

            <button
              onClick={handleEqualSplit}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
              title="Evenly divide 100% across unlocked categories"
            >
              <span>🔲 Equal Split</span>
            </button>

            {totalValue > 0 && (
              <button
                onClick={handleMatchCurrentHoldings}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                title="Set targets matching your current portfolio weightings"
              >
                <span>📊 Match Current Holdings</span>
              </button>
            )}
          </div>

          {/* Strategic Presets */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-neutral-500 font-bold uppercase text-[10px]">Presets:</span>
            <button
              onClick={() => applyPreset('aggressive')}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition-all ${
                activePreset === 'aggressive'
                  ? 'bg-white text-black font-bold border-white'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              Aggressive
            </button>
            <button
              onClick={() => applyPreset('balanced')}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition-all ${
                activePreset === 'balanced'
                  ? 'bg-white text-black font-bold border-white'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              Balanced
            </button>
            <button
              onClick={() => applyPreset('conservative')}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition-all ${
                activePreset === 'conservative'
                  ? 'bg-white text-black font-bold border-white'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              Conservative
            </button>
          </div>
        </div>

      </div>

      {/* ── Category Sliders & Percentage Controls Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {enriched.map(f => {
          const isLocked = Boolean(lockedFunds[f.id])
          const targetPct = Number(f.targetPct) || 0
          const currentPct = Number(f.currentPct) || 0
          const drift = Number((currentPct - targetPct).toFixed(1))
          const targetCapital = totalValue > 0 ? (totalValue * targetPct) / 100 : 0

          return (
            <div
              key={f.id}
              className={`ather-card p-4 bg-neutral-950/80 border transition-all relative overflow-hidden ${
                isLocked ? 'border-neutral-800 opacity-90' : 'border-neutral-700/80 hover:border-neutral-600'
              }`}
            >
              {/* Category Color Accent Strip */}
              <div
                className="absolute top-0 left-0 bottom-0 w-1.5"
                style={{ backgroundColor: f.color }}
              />

              <div className="pl-2 space-y-3.5">
                
                {/* Header: Name, Current Capital, Lock */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <div>
                      <h4 className="font-display font-bold text-white text-sm tracking-wide">
                        {f.name}
                      </h4>
                      <p className="text-[11px] font-mono text-neutral-400">
                        Current: <span className="text-neutral-200 font-semibold">{formatCurrency(f.currentValue)}</span> ({currentPct.toFixed(1)}%)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Lock Button */}
                    <button
                      type="button"
                      onClick={() => toggleLock(f.id)}
                      className={`p-1.5 rounded-lg border text-xs font-mono transition-all ${
                        isLocked
                          ? 'bg-amber-950/60 border-amber-500/80 text-amber-300'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                      title={isLocked ? 'Category is locked (will not change on auto-balance)' : 'Lock this category target %'}
                    >
                      {isLocked ? '🔒' : '🔓'}
                    </button>

                    {/* Numeric Target Input */}
                    <div className="relative w-24">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        disabled={isLocked}
                        value={targetPct}
                        onChange={(e) => handleTargetChange(f.id, e.target.value)}
                        className={`ather-input text-right font-mono font-bold text-sm pr-7 py-1.5 ${
                          isLocked ? 'bg-neutral-900 text-neutral-500 cursor-not-allowed' : 'text-white focus:border-emerald-400'
                        }`}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-mono font-bold pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                {/* Range Slider */}
                <div className="space-y-1.5">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    disabled={isLocked}
                    value={targetPct}
                    onChange={(e) => handleTargetChange(f.id, e.target.value)}
                    className="w-full h-2 bg-neutral-850 rounded-lg appearance-none cursor-pointer accent-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      accentColor: f.color
                    }}
                  />

                  {/* Stepper Buttons: -5%, -1%, +1%, +5% */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isLocked || targetPct <= 0}
                        onClick={() => handleStep(f.id, targetPct, -5)}
                        className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 disabled:opacity-40 disabled:pointer-events-none"
                        title="Subtract 5%"
                      >
                        -5%
                      </button>
                      <button
                        type="button"
                        disabled={isLocked || targetPct <= 0}
                        onClick={() => handleStep(f.id, targetPct, -1)}
                        className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 disabled:opacity-40 disabled:pointer-events-none"
                        title="Subtract 1%"
                      >
                        -1%
                      </button>
                    </div>

                    {/* Target Capital Goal */}
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Target Capital: <strong className="text-neutral-200">{formatCurrency(targetCapital)}</strong>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isLocked || targetPct >= 100}
                        onClick={() => handleStep(f.id, targetPct, 1)}
                        className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 disabled:opacity-40 disabled:pointer-events-none"
                        title="Add 1%"
                      >
                        +1%
                      </button>
                      <button
                        type="button"
                        disabled={isLocked || targetPct >= 100}
                        onClick={() => handleStep(f.id, targetPct, 5)}
                        className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 disabled:opacity-40 disabled:pointer-events-none"
                        title="Add 5%"
                      >
                        +5%
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Drift & Status Bar */}
                <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-neutral-850">
                  <span className="text-neutral-500">
                    Drift: <strong className={drift > 0 ? 'text-amber-400' : drift < 0 ? 'text-cyan-400' : 'text-emerald-400'}>
                      {drift > 0 ? `+${drift}% (Overweight)` : drift < 0 ? `${drift}% (Underweight)` : '0.0% (Aligned)'}
                    </strong>
                  </span>
                  <span className="text-neutral-400 text-[10px]">
                    Share of 100%: <span className="text-white font-bold">{targetPct.toFixed(1)}%</span>
                  </span>
                </div>

              </div>
            </div>
          )
        })}

        {funds.length === 0 && (
          <div className="col-span-2 text-center py-12 border border-dashed border-neutral-800 rounded-2xl bg-neutral-950/40 text-neutral-400 font-mono text-sm">
            // No asset categories found. Add categories in Fund Setup first.
          </div>
        )}
      </div>

    </div>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
          {/* Modal Header */}
          <div className="p-5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono text-sm font-bold">
                %
              </div>
              <div>
                <h3 className="text-white font-bold text-base font-display">Change Category Allocation Percentages</h3>
                <p className="text-xs text-neutral-400 font-mono">Fine-tune target weights for all portfolio asset classes</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors font-mono"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {content}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between shrink-0">
            <div className="text-xs font-mono text-neutral-400">
              Changes apply live to your equilibrium weekly allocator.
            </div>
            <button
              onClick={onClose}
              className="ather-btn-primary py-2 px-6 text-xs font-mono"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    )
  }

  return content
}
