import { formatCurrency, computeTotalValue } from '../utils/portfolio'

export default function AllocationResult({ result, funds, minLot, onApply, isInvested }) {
  if (!result) return null

  const { allocations, carryOver, fallbackUsed, reasons } = result

  const totalCurrentValue = computeTotalValue(funds)
  const totalAllocated = Object.values(allocations).reduce((sum, amt) => sum + (Number(amt) || 0), 0)
  const totalNewValue = totalCurrentValue + totalAllocated

  const allocated = funds
    .filter(f => (allocations[f.id] || 0) > 0)
    .map((f) => {
      const amount = allocations[f.id]
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
        reason: reasons.find(r => r.fundId === f.id),
      }
    })

  return (
    <div className="space-y-5">
      {/* Fallback info */}
      {fallbackUsed && (
        <div className="bg-black border border-neutral-700 rounded-xl p-4 text-xs font-mono text-neutral-300 flex items-start gap-3">
          <span className="text-white mt-0.5">//</span>
          <div>
            <span className="text-white font-bold">PORTFOLIO MEETS OR EXCEEDS ALL TARGETS:</span>
            <p className="text-neutral-400 mt-1">
              Capital routed to the largest capacity asset category by default.
            </p>
          </div>
        </div>
      )}

      {/* Result Cards */}
      {allocated.length === 0 ? (
        <div className="text-center text-neutral-400 py-10 text-sm font-mono border border-dashed border-neutral-800 rounded-xl">
          // INSUFFICIENT CAPITAL FOR MINIMUM LOT SIZE ({formatCurrency(minLot)})
        </div>
      ) : (
        <div className="space-y-3">
          {allocated.map((f, idx) => {
            const lots = f.amount / minLot
            return (
              <div
                key={f.id}
                className="bg-black border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 transition-all shadow-md"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-mono font-bold text-sm text-white border border-white/30 shrink-0"
                      style={{ background: f.color }}
                    >
                      0{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-display font-bold text-white text-base tracking-wide">
                          {f.name}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold">
                          TARGET {f.targetPct}%
                        </span>
                      </div>
                      <p className="text-xs font-mono text-neutral-400 mt-1">
                        {f.reason && !f.reason.fallback
                          ? `Deficit gap: ${formatCurrency(Math.abs(f.reason.gap))} to reach equilibrium`
                          : 'Target met. Allocated by capacity default.'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-mono font-extrabold text-white tracking-tight">
                      <span className="text-emerald-400">+{formatCurrency(f.amount)}</span>{' '}
                      <span className="text-lg text-emerald-300 font-bold">({f.newPct.toFixed(1)}%)</span>
                    </p>
                    <p className="text-xs font-mono text-neutral-400 mt-0.5 uppercase tracking-wider font-semibold">
                      {lots} LOT{lots > 1 ? 'S' : ''} × {formatCurrency(minLot)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Carry Over */}
      {carryOver > 0 && (
        <div className="bg-black border border-neutral-800 rounded-xl p-4 flex items-center justify-between text-sm font-mono">
          <div className="flex items-center gap-2.5 text-neutral-400">
            <span className="text-neutral-500">//</span>
            <span className="font-semibold">CARRY OVER TO NEXT WEEK:</span>
          </div>
          <span className="font-bold text-white text-base">
            {formatCurrency(carryOver)}
          </span>
        </div>
      )}

      {/* Apply Button */}
      {allocated.length > 0 && (
        <button
          id="btn-apply-allocation"
          onClick={onApply}
          className={`w-full py-4 text-sm font-bold tracking-widest mt-3 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg font-mono ${
            isInvested 
              ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700' 
              : 'ather-btn-primary'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span>
            {isInvested ? 'RE-APPLY ALLOCATION TO HOLDINGS' : 'APPLY THIS SATURDAY ALLOCATION'}
          </span>
        </button>
      )}
    </div>
  )
}

