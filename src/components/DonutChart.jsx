import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatCurrency, formatPct } from '../utils/portfolio'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div
      className="border border-neutral-600 rounded-xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-sm font-mono"
      style={{ backgroundColor: '#141414', opacity: 1 }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span
          className="w-3 h-3 rounded-full border border-white/40 flex-shrink-0"
          style={{ background: p.fill }}
        />
        <p className="font-bold text-white uppercase tracking-wider text-sm">{name}</p>
      </div>
      <div className="space-y-1.5 text-neutral-200">
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400 font-medium">HOLDINGS:</span>
          <span className="text-white font-bold">{formatCurrency(p.currentValue)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400 font-medium">CURRENT %:</span>
          <span className="text-white font-bold">{formatPct(value, 1)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400 font-medium">TARGET %:</span>
          <span className="text-neutral-300 font-bold">{p.targetPct}%</span>
        </div>
      </div>
    </div>
  )
}

export default function DonutChart({ enrichedFunds }) {
  const data = enrichedFunds
    .filter(f => f.currentValue > 0)
    .map((f) => ({
      name: f.name,
      value: f.currentPct,
      targetPct: f.targetPct,
      currentValue: f.currentValue,
      fill: f.color,
    }))

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-neutral-400 text-sm font-mono border border-dashed border-neutral-800 rounded-xl p-6">
        <span className="text-base font-bold text-neutral-300">// NO ACTIVE HOLDINGS RECORDED</span>
        <span className="text-neutral-400 mt-2 text-sm">Enter portfolio values in Fund Setup to visualize allocation</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      {/* Chart Canvas */}
      <div className="w-full lg:w-3/5 h-80 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={78}
              outerRadius={114}
              paddingAngle={3}
              dataKey="value"
              stroke="#0a0a0a"
              strokeWidth={3}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill}
                  stroke={entry.name.toLowerCase().includes('stock') ? '#FFFFFF' : '#0a0a0a'}
                  strokeWidth={entry.name.toLowerCase().includes('stock') ? 2 : 2}
                />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip />}
              wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest font-bold">TOTAL</span>
          <span className="text-2xl font-display font-extrabold text-white">{data.length} FUNDS</span>
        </div>
      </div>

      {/* Spacious Custom Legend */}
      <div className="w-full lg:w-2/5 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-xl bg-black border border-neutral-800 text-sm font-mono hover:border-neutral-600 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-3.5 h-3.5 rounded-md flex-shrink-0 border border-white/20"
                style={{ background: item.fill }}
              />
              <span className="text-neutral-200 font-medium truncate text-sm">{item.name}</span>
            </div>
            <span className="font-bold text-white ml-2 text-sm">
              {item.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
