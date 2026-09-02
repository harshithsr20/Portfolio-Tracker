import { useMemo } from 'react'
import { usePortfolio } from '../store/portfolioStore'
import { enrichFunds, formatCurrency, computeTargetSum } from '../utils/portfolio'
import { allocate } from '../utils/allocator'
import { getWeeklyScheduleInfo } from '../utils/schedule'
import DonutChart from '../components/DonutChart'
import AllocationBarChart from '../components/AllocationBarChart'
import DriftTable from '../components/DriftTable'
import DirectInvestCard from '../components/DirectInvestCard'

export default function Dashboard() {
  const { state } = usePortfolio()
  const { funds, carryOver, weeklyAmount = 200, minLot = 100 } = state
  const enriched = enrichFunds(funds)
  const totalValue = enriched[0]?.totalValue ?? 0
  const targetSum = computeTargetSum(funds)
  const isTargetValid = Math.abs(targetSum - 100) < 0.01

  const schedule = getWeeklyScheduleInfo()
  const effectiveAmount = weeklyAmount + (carryOver || 0)

  // Real-time allocation recalculation whenever any fund holding, target, or budget changes
  const allocationPlan = useMemo(() => {
    if (funds.length === 0) return null
    const res = allocate(funds, effectiveAmount, minLot)
    if (!res || !res.allocations) return null
    const totalAllocated = Object.values(res.allocations).reduce((sum, v) => sum + (Number(v) || 0), 0)
    const newTotal = totalValue + totalAllocated

    const allocFunds = enriched
      .filter(f => (res.allocations[f.id] || 0) > 0)
      .map(f => {
        const amount = res.allocations[f.id]
        const newVal = (Number(f.currentValue) || 0) + amount
        const newPct = newTotal > 0 ? (newVal / newTotal) * 100 : 0
        return {
          ...f,
          amount,
          newVal,
          newPct,
        }
      })
    return {
      funds: allocFunds,
      carryOver: res.carryOver,
      fallbackUsed: res.fallbackUsed,
    }
  }, [funds, effectiveAmount, minLot, enriched, totalValue])

  return (
    <div className="space-y-8">
      
      {/* Top Metric Cards - 3 Prominent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Value */}
        <div className="ather-card border-neutral-700 bg-neutral-950/90 shadow-lg">
          <div className="flex items-center justify-between text-neutral-400 font-mono text-xs uppercase tracking-widest mb-3">
            <span className="font-bold">TOTAL PORTFOLIO ASSETS</span>
            <span className="text-emerald-400 font-mono font-bold flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              ACTIVE
            </span>
          </div>
          <div className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            {formatCurrency(totalValue)}
          </div>
          <div className="flex items-center justify-between text-sm font-mono text-neutral-400 mt-5 pt-4 border-t border-neutral-800">
            <span>TRACKED HOLDINGS</span>
            <span className="text-white font-bold text-base">{funds.length} FUNDS</span>
          </div>
        </div>

        {/* Target Allocation Health */}
        <div className="ather-card border-neutral-700 bg-neutral-950/90 shadow-lg">
          <div className="flex items-center justify-between text-neutral-400 font-mono text-xs uppercase tracking-widest mb-3">
            <span className="font-bold">TARGET WEIGHT CALIBRATION</span>
            <span className={isTargetValid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {isTargetValid ? '✓ 100% BALANCED' : '⚠️ MISALIGNED'}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-display font-extrabold text-3xl sm:text-4xl text-white">
              {targetSum.toFixed(1)}%
            </span>
            <span className="text-sm font-mono text-neutral-400">/ 100% ALLOCATED</span>
          </div>
          
          {/* Visual Target Bar */}
          <div className="w-full bg-neutral-900 h-2.5 rounded-full overflow-hidden mt-5 border border-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${isTargetValid ? 'bg-white' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(targetSum, 100)}%` }}
            />
          </div>
        </div>

        {/* Next Saturday Investment Cadence Card */}
        <div className="ather-card border-neutral-700 bg-neutral-950/90 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-400 font-mono text-xs uppercase tracking-widest mb-3">
              <span className="font-bold">NEXT SATURDAY ALLOCATION</span>
              <span className={`font-mono font-bold text-xs ${schedule.isSaturday ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`}>
                {schedule.isSaturday ? '⚡ EXECUTE TODAY' : `${schedule.daysUntilSaturday}D REMAINING`}
              </span>
            </div>

            {allocationPlan && allocationPlan.funds.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {allocationPlan.funds.map((f, i) => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono font-bold text-white bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-md">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }}></span>
                      <span>{f.name}: <strong className="text-emerald-400">₹{f.amount}</strong> <span className="text-emerald-300 font-semibold">({f.newPct.toFixed(1)}%)</span></span>
                      {i < allocationPlan.funds.length - 1 && <span className="text-neutral-500 ml-1">+</span>}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] font-mono text-emerald-400/90 font-semibold pt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Recalculated for ₹{effectiveAmount} budget</span>
                </div>
              </div>
            ) : (
              <div className="font-display font-bold text-base text-neutral-400">
                Target ₹{weeklyAmount}/week · Configure funds in Setup
              </div>
            )}

            <p className="text-xs font-mono text-neutral-400 mt-2">
              Audited for {schedule.saturdayDateFormatted} · Drift minimizer
            </p>
          </div>
          <div className="pt-3 border-t border-neutral-800 mt-3 flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-500">CYCLE STATUS</span>
            <span className="text-white font-bold">{schedule.dayName.toUpperCase()}</span>
          </div>
        </div>

      </div>

      {/* Target Sum Warning */}
      {!isTargetValid && (
        <div className="bg-black border border-rose-800/80 rounded-2xl p-5 flex items-center justify-between gap-4 text-sm font-mono text-rose-300">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span>
              Target allocations sum to <strong className="text-white font-bold">{targetSum.toFixed(1)}%</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Donut Allocation */}
        <div className="ather-card lg:col-span-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-mono text-neutral-500 font-bold">01 //</span>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                CURRENT HOLDINGS DISTRIBUTION
              </h2>
            </div>
            <span className="text-xs font-mono text-neutral-500 uppercase font-semibold">RADIAL ALLOCATION</span>
          </div>
          <DonutChart enrichedFunds={enriched} />
        </div>

        {/* Side by side Bar chart */}
        <div className="ather-card lg:col-span-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-mono text-neutral-500 font-bold">02 //</span>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                CURRENT VS TARGET ALLOCATION
              </h2>
            </div>
            <span className="text-xs font-mono text-neutral-500 uppercase font-semibold">BAR COMPARISON</span>
          </div>
          <AllocationBarChart enrichedFunds={enriched} />
        </div>
      </div>

      {/* Drift Table */}
      <div className="ather-card p-0">
        <div className="p-5 sm:p-6 flex items-center justify-between border-b border-neutral-800 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-mono text-neutral-500 font-bold">03 //</span>
            <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              PORTFOLIO ASSET REGISTRY
            </h2>
          </div>
          <span className="text-xs font-mono text-neutral-400 font-semibold">
            REAL-TIME DRIFT CALCULATION
          </span>
        </div>
        <DriftTable enrichedFunds={enriched} />
      </div>

      {/* Manual Deposit: Add money by selecting fund */}
      <DirectInvestCard />

    </div>
  )
}
