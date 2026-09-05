import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const cur = payload.find(p => p.dataKey === 'currentPct')
  const tgt = payload.find(p => p.dataKey === 'targetPct')
  const drift = (cur?.value || 0) - (tgt?.value || 0)

  return (
    <div
      className="border border-neutral-600 rounded-xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-sm font-mono"
      style={{ backgroundColor: '#141414', opacity: 1 }}
    >
      <p className="font-bold text-white uppercase tracking-wider mb-2 text-sm">{label}</p>
      <div className="space-y-1.5 text-neutral-200">
        {cur && (
          <div className="flex items-center justify-between gap-6">
            <span className="text-neutral-400 font-medium">CURRENT:</span>
            <span className="text-white font-bold">{cur.value.toFixed(1)}%</span>
          </div>
        )}
        {tgt && (
          <div className="flex items-center justify-between gap-6">
            <span className="text-neutral-400 font-medium">TARGET:</span>
            <span className="text-neutral-300 font-bold">{tgt.value.toFixed(1)}%</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-6 pt-1.5 border-t border-neutral-800">
          <span className="text-neutral-400 font-medium">DELTA:</span>
          <span className={drift >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {drift >= 0 ? `+${drift.toFixed(2)}%` : `${drift.toFixed(2)}%`}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AllocationBarChart({ enrichedFunds }) {
  const data = enrichedFunds.map((f) => ({
    name: f.name.replace(' Fund', '').replace('Greater China', 'China').replace('Individual ', ''),
    fullName: f.name,
    currentPct: parseFloat(f.currentPct.toFixed(2)),
    targetPct: parseFloat(f.targetPct.toFixed(2)),
    color: f.color,
  }))

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-neutral-400 text-sm font-mono border border-dashed border-neutral-800 rounded-xl p-6">
        <span className="text-base font-bold text-neutral-300">// NO TARGET ALLOCATIONS DEFINED</span>
        <span className="text-neutral-400 mt-2 text-sm">Add funds in Fund Setup to see comparison chart</span>
      </div>
    )
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="24%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#a3a3a3', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}
            axisLine={{ stroke: '#333333' }}
            tickLine={false}
          />
          <YAxis
            unit="%"
            tick={{ fill: '#a3a3a3', fontSize: 12, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="square"
            iconSize={10}
            wrapperStyle={{ paddingBottom: '16px' }}
            formatter={(v) => (
              <span style={{ color: '#d4d4d4', fontSize: 12, fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 600 }}>
                {v === 'currentPct' ? 'Current %' : 'Target %'}
              </span>
            )}
          />
          {/* Current Bar: Fund Specific Color */}
          <Bar dataKey="currentPct" name="currentPct" radius={[4, 4, 0, 0]}>
            {data.map((d, index) => (
              <Cell key={`bar-${index}`} fill={d.color} stroke="#ffffff" strokeWidth={0.5} />
            ))}
          </Bar>
          {/* Target Bar: Neutral Slate / Outline */}
          <Bar dataKey="targetPct" name="targetPct" fill="#404040" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
