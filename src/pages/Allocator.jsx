import { useState, useMemo } from 'react'
import { usePortfolio } from '../store/portfolioStore'
import { enrichFunds, formatCurrency } from '../utils/portfolio'
import { allocate } from '../utils/allocator'
import { getWeeklyScheduleInfo } from '../utils/schedule'
import AllocationResult from '../components/AllocationResult'
import DirectInvestCard from '../components/DirectInvestCard'
import WeeklyScheduleBanner from '../components/WeeklyScheduleBanner'

export default function Allocator({ onNavigateToSetup }) {
  const { state, dispatch } = usePortfolio()
  const { funds, carryOver, weeklyAmount = 200, minLot = 100, weeklyInvestments = {} } = state
  const enriched = enrichFunds(funds)

  const schedule = getWeeklyScheduleInfo()
  const isInvested = Boolean(weeklyInvestments[schedule.cycleKey])

  // Effective investment amount: weekly budget + any carryover from previous calculation
  const investAmount = weeklyAmount
  const effectiveAmount = investAmount + (carryOver || 0)

  const [applied, setApplied] = useState(false)

  // Real-time greedy allocation calculation whenever funds, weeklyAmount, carryOver, or minLot change
  const result = useMemo(() => {
    if (funds.length === 0) return null
    return allocate(funds, effectiveAmount, minLot)
  }, [funds, effectiveAmount, minLot])

  function handleApply() {
    if (!result) return
    dispatch({
      type: 'APPLY_ALLOCATION',
      allocations: result.allocations,
      carryOver: result.carryOver,
      cycleKey: schedule.cycleKey,
      amount: investAmount,
    })
    setApplied(true)
    setTimeout(() => setApplied(false), 5000)
  }

  function handleAmountChange(amount) {
    dispatch({ type: 'SET_WEEKLY_AMOUNT', amount })
  }

  function handleMinLotChange(lot) {
    dispatch({ type: 'SET_MIN_LOT', minLot: lot })
  }

  function handleResetInvested() {
    dispatch({ type: 'RESET_CYCLE_INVESTMENT', cycleKey: schedule.cycleKey })
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* ── Section 1: Weekly Investment Schedule & Day Tracker ── */}
      <WeeklyScheduleBanner
        weeklyAmount={weeklyAmount}
        onAmountChange={handleAmountChange}
        minLot={minLot}
        onMinLotChange={handleMinLotChange}
        isInvested={isInvested}
        onResetInvested={handleResetInvested}
      />

      {/* Success Notification */}
      {applied && (
        <div className="bg-neutral-900 border border-emerald-500/60 rounded-2xl p-5 text-sm font-mono text-white flex items-center justify-between gap-4 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
            <span className="text-base">
              <strong>ALLOCATION APPLIED:</strong> ₹{investAmount} credited to fund holdings for {schedule.saturdayDateFormatted}!
            </span>
          </div>
          <span className="text-emerald-400 font-bold uppercase tracking-widest text-xs">
            COMPLETED
          </span>
        </div>
      )}

      {/* ── Section 2: Where to Invest for Target Saturday ── */}
      <div className="ather-card border-neutral-700 bg-neutral-950/90 shadow-md">
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-neutral-800">
              <div>
                <span className="text-sm font-mono font-bold text-white uppercase tracking-wider block">
                  RECOMMENDED FOR {schedule.saturdayDateFormatted.toUpperCase()}
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  Audited on {schedule.sundayDateFormatted} · Equilibrium Drift Minimization
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-emerald-400 font-bold">
                  ₹{effectiveAmount} DEPLOYMENT
                </span>
              </div>
            </div>

            <AllocationResult
              result={result}
              funds={enriched}
              minLot={minLot}
              onApply={handleApply}
              isInvested={isInvested}
            />
          </div>
        )}

        {!result && funds.length > 0 && (
          <div className="text-center text-neutral-400 py-10 text-sm font-mono border border-dashed border-neutral-800 rounded-xl">
            // NO ALLOCATION POSSIBLE WITH CURRENT PARAMETERS
          </div>
        )}

        {funds.length === 0 && (
          <div className="text-center py-10 px-4 space-y-3">
            <p className="text-neutral-400 text-sm font-mono">// NO ASSET CATEGORIES CONFIGURED</p>
            <p className="text-xs text-neutral-500 font-mono">Configure your funds, current capital, and target weights first to generate weekly allocation recommendations.</p>
            {onNavigateToSetup && (
              <button
                onClick={onNavigateToSetup}
                className="ather-btn-primary text-xs py-2 px-4 inline-flex items-center gap-2 mt-2"
              >
                Go to Fund Setup →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Section 3: Add Money to a Fund ── */}
      <DirectInvestCard />

    </div>
  )
}

