import { useState, useMemo } from 'react'
import { usePortfolio } from '../store/portfolioStore'
import { computeTargetSum, getFundColor, enrichFunds, formatCurrency } from '../utils/portfolio'
import { allocate } from '../utils/allocator'
import { getWeeklyScheduleInfo } from '../utils/schedule'

function FundRow({ fund, onChange, onRemove }) {
  return (
    <tr className="hover:bg-neutral-900/60 transition-colors group">
      {/* Category Name */}
      <td className="ather-td">
        <div className="flex items-center gap-3">
          <label className="relative flex-shrink-0 cursor-pointer w-6 h-6 rounded-md overflow-hidden border border-white/30" title="Choose color">
            <input 
              type="color" 
              className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer"
              value={fund.color || getFundColor(fund.name || fund.id, 0)} 
              onChange={e => onChange(fund.id, 'color', e.target.value)}
            />
          </label>
          <input
            id={`fund-name-${fund.id}`}
            className="ather-input font-sans text-base font-medium"
            value={fund.name}
            onChange={e => onChange(fund.id, 'name', e.target.value)}
            placeholder="Asset category name"
          />
        </div>
      </td>

      {/* Target % */}
      <td className="ather-td w-44 sm:w-52">
        <div className="relative">
          <input
            id={`fund-target-${fund.id}`}
            type="number"
            min="0"
            max="100"
            step="0.5"
            className="ather-input pr-10 text-right font-bold text-white text-base focus:border-emerald-400"
            value={fund.targetPct}
            onChange={e => onChange(fund.id, 'targetPct', parseFloat(e.target.value) || 0)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-mono font-bold pointer-events-none">%</span>
        </div>
      </td>

      {/* Current Value */}
      <td className="ather-td w-52 sm:w-64">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-mono font-bold pointer-events-none">₹</span>
          <input
            id={`fund-value-${fund.id}`}
            type="number"
            min="0"
            step="100"
            className="ather-input pl-9 font-bold text-white text-right text-base focus:border-emerald-400"
            value={fund.currentValue}
            onChange={e => onChange(fund.id, 'currentValue', parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      {/* Remove Action */}
      <td className="ather-td w-20 text-center">
        <button
          id={`fund-remove-${fund.id}`}
          onClick={() => onRemove(fund.id)}
          className="ather-btn-danger"
          title="Remove asset category"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

export default function FundSetup({ onNavigateToDashboard }) {
  const { state, dispatch } = usePortfolio()
  const { funds, weeklyAmount = 200, minLot = 100, carryOver = 0 } = state
  const [saved, setSaved] = useState(false)
  const [appliedMsg, setAppliedMsg] = useState('')

  const targetSum = computeTargetSum(funds)
  const isSumOk = Math.abs(targetSum - 100) < 0.01

  const enriched = enrichFunds(funds)
  const schedule = getWeeklyScheduleInfo()
  const effectiveAmount = weeklyAmount + (carryOver || 0)

  // Real-time live allocation calculation every time any number changes
  const liveAllocation = useMemo(() => {
    if (funds.length === 0) return null
    return allocate(funds, effectiveAmount, minLot)
  }, [funds, effectiveAmount, minLot])

  const allocatedFunds = useMemo(() => {
    if (!liveAllocation || !liveAllocation.allocations) return []
    const totalCurrentValue = computeTotalValue(funds)
    const totalAllocated = Object.values(liveAllocation.allocations).reduce((sum, v) => sum + (Number(v) || 0), 0)
    const totalNewValue = totalCurrentValue + totalAllocated

    return enriched
      .filter(f => (liveAllocation.allocations[f.id] || 0) > 0)
      .map(f => {
        const amount = liveAllocation.allocations[f.id]
        const currentVal = Number(f.currentValue) || 0
        const newVal = currentVal + amount
        const currentPct = totalCurrentValue > 0 ? (currentVal / totalCurrentValue) * 100 : 0
        const newPct = totalNewValue > 0 ? (newVal / totalNewValue) * 100 : 0
        const pctDelta = newPct - currentPct

        return {
          ...f,
          amount,
          currentPct,
          newPct,
          pctDelta,
          newVal,
          reason: liveAllocation.reasons.find(r => r.fundId === f.id),
        }
      })
  }, [liveAllocation, enriched, funds])

  function handleChange(id, field, value) {
    dispatch({ type: 'UPDATE_FUND', id, changes: { [field]: value } })
    setSaved(false)
  }

  function handleAdd() {
    dispatch({ type: 'ADD_FUND' })
    setSaved(false)
  }

  function handleRemove(id) {
    dispatch({ type: 'REMOVE_FUND', id })
    setSaved(false)
  }

  function handleLoadTemplate() {
    if (funds.length > 0 && !confirm('This will replace your current fund list with the standard 6-category starter template. Continue?')) {
      return
    }
    dispatch({ type: 'LOAD_TEMPLATE_FUNDS' })
    setSaved(false)
  }

  function handleResetAll() {
    if (confirm('Are you sure you want to clear all funds and start with a blank list?')) {
      dispatch({ type: 'CLEAR_ALL_FUNDS' })
      setSaved(false)
    }
  }

  function handleSave(andGoToDashboard = false) {
    dispatch({ type: 'SAVE_SNAPSHOT' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    if (andGoToDashboard && onNavigateToDashboard) {
      onNavigateToDashboard()
    }
  }

  // Auto-balance feature
  function handleAutoBalance() {
    if (funds.length === 0) return
    const otherSum = funds.slice(0, -1).reduce((s, f) => s + (Number(f.targetPct) || 0), 0)
    const remainder = Math.max(0, 100 - otherSum)
    const lastFund = funds[funds.length - 1]
    dispatch({
      type: 'UPDATE_FUND',
      id: lastFund.id,
      changes: { targetPct: parseFloat(remainder.toFixed(2)) }
    })
  }

  function handleQuickApply() {
    if (!liveAllocation) return
    dispatch({
      type: 'APPLY_ALLOCATION',
      allocations: liveAllocation.allocations,
      carryOver: liveAllocation.carryOver,
      cycleKey: schedule.cycleKey,
      amount: weeklyAmount,
    })
    setAppliedMsg(`✓ Allocation applied! ₹${weeklyAmount} added across target funds.`)
    setTimeout(() => setAppliedMsg(''), 4000)
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-mono text-neutral-500 font-bold">SETUP //</span>
            <h2 className="text-2xl font-display font-extrabold text-white tracking-wide">
              FUND ASSET ALLOCATION CONFIGURATION
            </h2>
          </div>
          <p className="text-sm font-mono text-neutral-400 mt-1.5">
            Configure your funds, current investment capital (₹), and target allocation percentages.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button id="btn-add-fund" onClick={handleAdd} className="ather-btn-secondary">
            + Add Asset Category
          </button>
          <button id="btn-template-fund" onClick={handleLoadTemplate} className="ather-btn-ghost text-xs">
            ⚡ Load Starter Template
          </button>
          {funds.length > 0 && (
            <button id="btn-clear-funds" onClick={handleResetAll} className="ather-btn-ghost text-xs text-rose-400 hover:text-rose-300">
              ↺ Reset
            </button>
          )}
          <button
            id="btn-save-snapshot"
            onClick={() => handleSave(false)}
            disabled={!isSumOk || funds.length === 0}
            className="ather-btn-primary"
          >
            {saved ? '✓ SNAPSHOT RECORDED' : 'SAVE SNAPSHOT'}
          </button>
          {funds.length > 0 && isSumOk && onNavigateToDashboard && (
            <button
              id="btn-save-continue"
              onClick={() => handleSave(true)}
              className="ather-btn-primary bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
            >
              SAVE & GO TO DASHBOARD →
            </button>
          )}
        </div>
      </div>

      {/* New User Welcome / Guidance Banner */}
      {funds.length === 0 && (
        <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-700/80 shadow-xl space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-xl font-mono flex-shrink-0">
              👋
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white font-display">
                Welcome to Portfolio Tracker!
              </h3>
              <p className="text-sm font-mono text-neutral-300">
                To start tracking your investments, add your mutual funds / asset categories below. For each category:
              </p>
              <ul className="text-xs font-mono text-neutral-400 space-y-1 pt-2 list-disc list-inside">
                <li>Enter the <strong className="text-neutral-200">Asset Category Name</strong> (e.g. Nifty 50, Mid Cap, Small Cap, Gold, Stocks)</li>
                <li>Enter your <strong className="text-neutral-200">Current Capital (₹)</strong> currently invested in that category</li>
                <li>Set your ideal <strong className="text-neutral-200">Target Weight %</strong> (all targets must sum to 100%)</li>
              </ul>
            </div>
          </div>
          <div className="pt-2 flex items-center gap-3 flex-wrap border-t border-neutral-800">
            <button onClick={handleAdd} className="ather-btn-primary text-xs py-2 px-4">
              + Add First Asset Category
            </button>
            <button onClick={handleLoadTemplate} className="ather-btn-secondary text-xs py-2 px-4">
              ⚡ Load Standard 6-Fund Template
            </button>
          </div>
        </div>
      )}

      {appliedMsg && (
        <div className="bg-neutral-900 border border-emerald-500/60 rounded-2xl p-4 text-sm font-mono text-white flex items-center justify-between gap-4 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
            <span className="text-emerald-300 font-semibold">{appliedMsg}</span>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className={`p-5 rounded-2xl border flex items-center justify-between flex-wrap gap-4 text-sm font-mono ${
        funds.length === 0
          ? 'bg-neutral-950 border-neutral-800 text-neutral-400'
          : isSumOk
          ? 'bg-neutral-950 border-neutral-800 text-neutral-200 shadow-md'
          : 'bg-black border-neutral-700 text-neutral-300'
      }`}>
        <div className="flex items-center gap-3.5">
          <span className={`w-3 h-3 rounded-full ${funds.length === 0 ? 'bg-neutral-500' : isSumOk ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className="text-base">
            TARGET ALLOCATION SUM: <strong className="text-white text-lg font-bold">{targetSum.toFixed(1)}%</strong>
            {funds.length === 0
              ? ' (NO FUNDS ADDED YET)'
              : isSumOk 
              ? ' (PERFECTLY BALANCED)' 
              : ` (DELTA: ${(100 - targetSum).toFixed(1)}%)`}
          </span>
        </div>

        {!isSumOk && funds.length > 0 && (
          <button
            onClick={handleAutoBalance}
            className="ather-btn-secondary text-xs py-2 px-4 bg-neutral-900 border-neutral-700 text-white hover:border-white"
          >
            Auto-balance remainder to {funds[funds.length - 1].name}
          </button>
        )}
      </div>

      {/* Editable Table */}
      <div className="ather-card p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="ather-th">ASSET / FUND CATEGORY</th>
                <th className="ather-th text-right">TARGET WEIGHT %</th>
                <th className="ather-th text-right">CURRENT CAPITAL (₹)</th>
                <th className="ather-th text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {funds.map(f => (
                <FundRow
                  key={f.id}
                  fund={f}
                  onChange={handleChange}
                  onRemove={handleRemove}
                />
              ))}
              {funds.length === 0 && (
                <tr>
                  <td colSpan={4} className="ather-td text-center text-neutral-400 py-16 font-mono text-sm">
                    // NO ASSET CATEGORIES DEFINED. CLICK "+ ADD ASSET CATEGORY" TO BEGIN.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        {funds.length > 0 && (
          <div className="flex items-center justify-between px-7 py-5 bg-black border-t border-neutral-800 text-sm font-mono">
            <span className="text-neutral-400 uppercase tracking-widest font-bold">TOTAL TARGET WEIGHT</span>
            <div className="flex items-center gap-2.5">
              <span className={`text-xl font-extrabold ${isSumOk ? 'text-white' : 'text-neutral-400'}`}>
                {targetSum.toFixed(1)}%
              </span>
              <span className="text-neutral-500 text-base">/ 100.0%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Live Dynamic Allocation Recalculation Impact Box ── */}
      {funds.length > 0 && (
        <div className="ather-card border-neutral-700 bg-neutral-950/95 shadow-xl relative overflow-hidden">
          {/* Top Header Row */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-mono text-neutral-500 font-bold">LIVE IMPACT //</span>
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                REAL-TIME ALLOCATION RECALCULATION
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                ⚡ RECALCULATED ON NUMBER CHANGE
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400 flex-wrap gap-2">
              <span>
                Based on current numbers for <strong className="text-white">₹{effectiveAmount} weekly budget</strong> (₹{minLot} min lot size):
              </span>
              <span className="text-neutral-500">
                Target Saturday: {schedule.saturdayDateFormatted}
              </span>
            </div>

            {allocatedFunds.length === 0 ? (
              <div className="p-4 rounded-xl bg-black border border-neutral-800 text-xs font-mono text-neutral-400 text-center">
                // Minimum budget or allocation threshold not reached. Adjust numbers above.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allocatedFunds.map((f, idx) => (
                  <div
                    key={f.id}
                    className="p-4 rounded-xl bg-black border border-neutral-800 flex items-center justify-between gap-3 hover:border-neutral-600 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-white border border-white/20"
                        style={{ background: f.color }}
                      >
                        0{idx + 1}
                      </div>
                      <div>
                        <span className="font-display font-bold text-white text-sm block">
                          {f.name}
                        </span>
                        <span className="text-[11px] font-mono text-neutral-400">
                          Holdings: {formatCurrency(f.currentValue)} · Target: {f.targetPct}%
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-extrabold text-white text-lg block">
                        <span className="text-emerald-400">+{formatCurrency(f.amount)}</span>{' '}
                        <span className="text-sm text-emerald-300 font-bold">({f.newPct.toFixed(1)}%)</span>
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 uppercase">
                        {f.amount / minLot} lot{(f.amount / minLot) > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {liveAllocation?.carryOver > 0 && (
              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400">
                <span>Carry over to next week:</span>
                <span className="text-white font-bold">{formatCurrency(liveAllocation.carryOver)}</span>
              </div>
            )}

            {allocatedFunds.length > 0 && (
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleQuickApply}
                  className="ather-btn-secondary text-xs py-2 px-4 text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/40 font-mono"
                >
                  ✓ Apply This Allocation Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="flex items-center gap-2.5 text-xs font-mono text-neutral-400">
        <span className="text-neutral-300 font-bold">// NOTE:</span>
        <span>Modifications are auto-saved locally in your browser. Target weights must sum to 100% to save a snapshot.</span>
      </div>

    </div>
  )
}
