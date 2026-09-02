import { getWeeklyScheduleInfo } from '../utils/schedule'
import { formatCurrency } from '../utils/portfolio'

export default function WeeklyScheduleBanner({ 
  weeklyAmount, 
  onAmountChange, 
  minLot = 100,
  onMinLotChange,
  isInvested, 
  onResetInvested 
}) {
  const schedule = getWeeklyScheduleInfo()
  const { 
    dayName, 
    isSunday, 
    isSaturday, 
    daysUntilSaturday, 
    sundayDateFormatted, 
    saturdayDateFormatted,
    stageTitle,
    stageDesc
  } = schedule

  return (
    <div className="ather-card border-neutral-700 bg-neutral-950/95 shadow-xl relative overflow-hidden">
      {/* Subtle glowing ambient accent */}
      <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 opacity-20 ${
        isSaturday ? 'bg-emerald-500' : isSunday ? 'bg-indigo-500' : 'bg-cyan-500'
      }`} />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-5 border-b border-neutral-800 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full animate-pulse ${
            isSaturday ? 'bg-emerald-400' : isSunday ? 'bg-indigo-400' : 'bg-cyan-400'
          }`} />
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-display font-extrabold text-lg text-white uppercase tracking-wider">
                WEEKLY INVESTMENT CYCLE
              </h2>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                isSaturday 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                  : isSunday 
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40' 
                  : 'bg-neutral-900 text-cyan-300 border-cyan-500/30'
              }`}>
                TODAY: {dayName.toUpperCase()}
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-400 mt-1">
              Sunday Portfolio Audit ➔ Saturday Investment Execution
            </p>
          </div>
        </div>

        {/* Investment Budget & Lot Size Configuration */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Weekly Budget */}
          <div className="flex items-center gap-2.5 bg-black/80 border border-neutral-800 rounded-xl px-3 py-2">
            <span className="text-xs font-mono text-neutral-400 uppercase font-semibold">
              BUDGET:
            </span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-bold text-neutral-400">₹</span>
              <input 
                type="number"
                min="100"
                step="100"
                value={weeklyAmount}
                onChange={(e) => onAmountChange(Number(e.target.value))}
                className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm font-mono font-bold text-white text-right focus:outline-none focus:border-emerald-400"
                title="Weekly investment budget"
              />
            </div>
          </div>

          {/* Lot Size */}
          {onMinLotChange && (
            <div className="flex items-center gap-2.5 bg-black/80 border border-neutral-800 rounded-xl px-3 py-2">
              <span className="text-xs font-mono text-neutral-400 uppercase font-semibold">
                MIN LOT:
              </span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-mono font-bold text-neutral-400">₹</span>
                <input 
                  type="number"
                  min="10"
                  step="50"
                  value={minLot}
                  onChange={(e) => onMinLotChange(Number(e.target.value))}
                  className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm font-mono font-bold text-white text-right focus:outline-none focus:border-emerald-400"
                  title="Minimum lot size per fund"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cycle Stage Timeline Track */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-5 relative z-10">
        {/* Step 1: Sunday Audit */}
        <div className={`p-4 rounded-xl border transition-all ${
          isSunday 
            ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30' 
            : 'bg-black/60 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-neutral-500 font-bold">01 // SUNDAY</span>
            <span className={isSunday ? 'text-indigo-300 font-bold' : 'text-neutral-400'}>
              {isSunday ? 'ACTIVE TODAY' : 'AUDITED'}
            </span>
          </div>
          <p className="font-display font-bold text-sm text-white">Portfolio Audit</p>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            {sundayDateFormatted}
          </p>
        </div>

        {/* Step 2: Midweek Strategy */}
        <div className={`p-4 rounded-xl border transition-all ${
          schedule.isMidWeek 
            ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30' 
            : 'bg-black/60 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-neutral-500 font-bold">02 // MON - FRI</span>
            <span className={schedule.isMidWeek ? 'text-cyan-300 font-bold' : 'text-neutral-400'}>
              {schedule.isMidWeek ? `${daysUntilSaturday}d to Saturday` : 'LOCKED IN'}
            </span>
          </div>
          <p className="font-display font-bold text-sm text-white">Capital Readiness</p>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            Strategy preserved for deployment
          </p>
        </div>

        {/* Step 3: Saturday Investment */}
        <div className={`p-4 rounded-xl border transition-all ${
          isSaturday 
            ? 'bg-emerald-950/50 border-emerald-500 shadow-lg ring-2 ring-emerald-500/40' 
            : isInvested
            ? 'bg-emerald-950/20 border-emerald-800/60'
            : 'bg-black/60 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-neutral-500 font-bold">03 // SATURDAY</span>
            <span className={isSaturday ? 'text-emerald-400 font-bold uppercase animate-pulse' : isInvested ? 'text-emerald-400 font-bold' : 'text-neutral-400'}>
              {isSaturday ? '🔥 EXECUTE TODAY' : isInvested ? '✓ COMPLETED' : 'TARGET'}
            </span>
          </div>
          <p className="font-display font-bold text-sm text-white">Investment Day</p>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            {saturdayDateFormatted}
          </p>
        </div>
      </div>

      {/* Dynamic Status Callout Alert Banner */}
      <div className={`rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap text-xs font-mono relative z-10 border ${
        isInvested
          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
          : isSaturday
          ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-lg'
          : isSunday
          ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
          : 'bg-neutral-900/90 border-neutral-800 text-neutral-300'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-lg">
            {isInvested ? '✅' : isSaturday ? '🚀' : isSunday ? '⚡' : '🗓️'}
          </span>
          <div>
            <span className="font-bold text-sm uppercase text-white block">
              {isInvested ? 'WEEKLY INVESTMENT LOGGED' : stageTitle}
            </span>
            <p className="text-neutral-300 mt-0.5">
              {isInvested 
                ? `You have applied this week's ₹${weeklyAmount} allocation for ${saturdayDateFormatted}.` 
                : stageDesc}
            </p>
          </div>
        </div>

        {isInvested && onResetInvested && (
          <button
            onClick={onResetInvested}
            className="text-xs font-mono text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 transition-colors"
          >
            Re-calculate Allocation
          </button>
        )}
      </div>
    </div>
  )
}
