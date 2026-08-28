import { useState } from 'react'
import { usePortfolio } from '../store/portfolioStore'
import { computeTargetSum } from '../utils/portfolio'

function FundRow({ fund, onChange, onRemove }) {
  return (
    <tr className="hover:bg-neutral-900/60 transition-colors group">
      {/* Category Name */}
      <td className="ather-td">
        <div className="flex items-center gap-3">
          <span
            className="w-3.5 h-3.5 rounded-md flex-shrink-0 border border-white/30"
            style={{ background: fund.color }}
          />
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
            className="ather-input pr-10 text-right font-bold text-white text-base"
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
            className="ather-input pl-9 font-bold text-white text-right text-base"
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

export default function FundSetup() {
  const { state, dispatch } = usePortfolio()
  const { funds } = state
  const [saved, setSaved] = useState(false)

  const targetSum = computeTargetSum(funds)
  const isSumOk = Math.abs(targetSum - 100) < 0.01

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

  function handleSave() {
    dispatch({ type: 'SAVE_SNAPSHOT' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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
            Configure ideal target weights and live holdings across your asset categories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button id="btn-add-fund" onClick={handleAdd} className="ather-btn-secondary">
            + Add Asset Category
          </button>
          <button
            id="btn-save-snapshot"
            onClick={handleSave}
            disabled={!isSumOk}
            className="ather-btn-primary"
          >
            {saved ? '✓ SNAPSHOT RECORDED' : 'SAVE SNAPSHOT'}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`p-5 rounded-2xl border flex items-center justify-between flex-wrap gap-4 text-sm font-mono ${
        isSumOk
          ? 'bg-neutral-950 border-neutral-800 text-neutral-200 shadow-md'
          : 'bg-black border-neutral-700 text-neutral-300'
      }`}>
        <div className="flex items-center gap-3.5">
          <span className={`w-3 h-3 rounded-full ${isSumOk ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className="text-base">
            TARGET ALLOCATION SUM: <strong className="text-white text-lg font-bold">{targetSum.toFixed(1)}%</strong>
            {isSumOk ? ' (PERFECTLY BALANCED)' : ` (DELTA: ${(100 - targetSum).toFixed(1)}%)`}
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

      {/* Note */}
      <div className="flex items-center gap-2.5 text-xs font-mono text-neutral-400">
        <span className="text-neutral-300 font-bold">// NOTE:</span>
        <span>Modifications are auto-saved locally in your browser. Target weights must sum to 100% to save a snapshot.</span>
      </div>

    </div>
  )
}
