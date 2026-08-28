import { useState } from 'react'
import { usePortfolio } from '../store/portfolioStore'
import { enrichFunds, formatCurrency } from '../utils/portfolio'

export default function DirectInvestCard() {
  const { state, dispatch } = usePortfolio()
  const { funds } = state
  const enriched = enrichFunds(funds)

  const [selectedFundId, setSelectedFundId] = useState(funds[0]?.id || '')
  const [amount, setAmount] = useState(500)
  const [successMsg, setSuccessMsg] = useState('')

  const selectedFund = enriched.find(f => f.id === selectedFundId) || enriched[0]

  const quickPresets = [100, 200, 500, 1000, 2000, 5000]

  function handleDirectDeposit(e) {
    e.preventDefault()
    const depositAmt = Number(amount)
    if (!selectedFundId || depositAmt <= 0) return

    dispatch({
      type: 'ADD_TO_FUND',
      id: selectedFundId,
      amount: depositAmt,
    })

    setSuccessMsg(`✓ Added ${formatCurrency(depositAmt)} to ${selectedFund?.name}. New value: ${formatCurrency((selectedFund?.currentValue || 0) + depositAmt)}`)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  if (funds.length === 0) return null

  return (
    <div className="ather-card border-neutral-700 bg-neutral-950/90 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-neutral-800 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-mono text-neutral-500 font-bold">MANUAL DEPOSIT //</span>
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
            ADD MONEY DIRECTLY TO A FUND
          </h3>
        </div>
        <span className="text-xs font-mono text-neutral-400 font-semibold">
          CUSTOM INVESTMENT
        </span>
      </div>

      {successMsg && (
        <div className="mt-4 p-4 rounded-xl bg-neutral-900 border border-emerald-500/60 text-emerald-400 font-mono text-sm flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleDirectDeposit} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Select Fund */}
          <div className="md:col-span-6 space-y-2">
            <label htmlFor="select-fund" className="text-xs font-mono text-neutral-300 uppercase font-bold block">
              1. SELECT ASSET CATEGORY
            </label>
            <div className="relative">
              <select
                id="select-fund"
                value={selectedFundId}
                onChange={e => setSelectedFundId(e.target.value)}
                className="ather-input py-3 text-sm font-sans font-semibold appearance-none pr-10 cursor-pointer"
              >
                {enriched.map(f => (
                  <option key={f.id} value={f.id} className="bg-neutral-950 text-white py-2">
                    {f.name} (Holdings: {formatCurrency(f.currentValue)} | Target: {f.targetPct}%)
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                ▼
              </div>
            </div>
          </div>

          {/* Amount to Invest */}
          <div className="md:col-span-6 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="manual-amount" className="text-xs font-mono text-neutral-300 uppercase font-bold block">
                2. AMOUNT TO INVEST (₹)
              </label>
              <span className="text-[11px] font-mono text-neutral-400">INCREMENTS OF ₹100</span>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-base font-bold pointer-events-none">₹</span>
              <input
                id="manual-amount"
                type="number"
                min="100"
                step="100"
                className="ather-input pl-9 text-lg font-bold text-white py-2.5"
                value={amount}
                onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                required
              />
            </div>
          </div>

        </div>

        {/* Quick Amount Presets */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <span className="text-xs font-mono text-neutral-400 font-bold">QUICK PRESETS:</span>
          {quickPresets.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                amount === preset
                  ? 'bg-white text-black'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-600'
              }`}
            >
              +₹{preset}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedFundId || amount <= 0}
          className="ather-btn-primary w-full py-3.5 text-sm font-bold tracking-wider"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>INVEST {formatCurrency(amount)} INTO {selectedFund?.name?.toUpperCase()}</span>
        </button>
      </form>
    </div>
  )
}
