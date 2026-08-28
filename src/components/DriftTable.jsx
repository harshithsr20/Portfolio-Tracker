import { formatCurrency, formatPct } from '../utils/portfolio'

function DriftBadge({ drift }) {
  const abs = Math.abs(drift)
  if (abs < 0.05) {
    return (
      <span className="ather-badge ather-badge-neutral">
        <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
        <span>ON TARGET</span>
      </span>
    )
  }
  if (drift > 0) {
    return (
      <span className="ather-badge ather-badge-over">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>▲ {formatPct(drift)} OVER</span>
      </span>
    )
  }
  return (
    <span className="ather-badge ather-badge-under">
      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
      <span>▼ {formatPct(drift)} UNDER</span>
    </span>
  )
}

export default function DriftTable({ enrichedFunds }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="ather-th">FUND CATEGORY</th>
            <th className="ather-th text-right">CURRENT HOLDINGS</th>
            <th className="ather-th text-right">CURRENT %</th>
            <th className="ather-th text-right">TARGET %</th>
            <th className="ather-th text-right">STATUS / DRIFT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900">
          {enrichedFunds.map((f) => (
            <tr key={f.id} className="hover:bg-neutral-900/60 transition-colors group">
              <td className="ather-td">
                <div className="flex items-center gap-3.5">
                  <span
                    className="w-3.5 h-3.5 rounded-md flex-shrink-0 border border-white/30"
                    style={{ background: f.color }}
                  />
                  <span className="font-sans font-semibold text-white text-base group-hover:text-neutral-200 transition-colors">
                    {f.name}
                  </span>
                </div>
              </td>
              <td className="ather-td text-right text-white font-bold text-base">
                {formatCurrency(f.currentValue)}
              </td>
              <td className="ather-td text-right text-neutral-200 font-semibold text-base">
                {f.currentPct.toFixed(1)}%
              </td>
              <td className="ather-td text-right text-neutral-400 font-semibold text-base">
                {f.targetPct.toFixed(1)}%
              </td>
              <td className="ather-td text-right">
                <DriftBadge drift={f.driftPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
