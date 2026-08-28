import { useState } from 'react'
import { usePortfolio } from '../store/portfolioStore'

export const DEFAULT_MF_FUNDS = [
  { id: 'hdfc-nifty-50',     name: 'HDFC Nifty 50 Index Fund',                    category: 'Large Cap / Index', benchmark: 'Nifty 50 TRI' },
  { id: 'nippon-growth',     name: 'Nippon India Growth Fund',                    category: 'Mid Cap',           benchmark: 'Nifty Midcap 150 TRI' },
  { id: 'edelweiss-small',   name: 'Edelweiss Small Cap Fund',                    category: 'Small Cap',         benchmark: 'Nifty Smallcap 250 TRI' },
  { id: 'edelweiss-us-tech', name: 'Edelweiss US Technology Equity FOF',          category: 'Overseas / Tech',   benchmark: 'Russell 1000 Equal Weight Tech' },
  { id: 'edelweiss-china',   name: 'Edelweiss Greater China Equity Off-shore Fund', category: 'Overseas / FoF',    benchmark: 'MSCI Golden Dragon Index' },
  { id: 'axis-liquid',       name: 'Axis Liquid Fund',                            category: 'Debt / Liquid',     benchmark: 'NIFTY Liquid Index A-I' }
]

export function normalizeFundKey(name) {
  if (!name) return ''
  const s = name.toLowerCase()
  if (s.includes('nifty 50') || s.includes('hdfc nifty')) return 'hdfc-nifty-50'
  if (s.includes('growth') || s.includes('nippon') || s.includes('mid cap') || s.includes('midcap')) return 'nippon-growth'
  if (s.includes('small cap') || s.includes('smallcap')) return 'edelweiss-small'
  if (s.includes('us tech') || s.includes('technology')) return 'edelweiss-us-tech'
  if (s.includes('china') || s.includes('greater china')) return 'edelweiss-china'
  if (s.includes('liquid') || s.includes('axis')) return 'axis-liquid'
  return s.replace(/[^a-z0-9]/g, '-').slice(0, 30)
}

export default function MfData({ onNavigateToAnalyzer, initialFundId }) {
  const { state, dispatch } = usePortfolio()
  const mfData = state.mfData || {}
  const [selectedFundId, setSelectedFundId] = useState(initialFundId || null)

  // Merge default funds with any dynamically saved funds in mfData
  const allFundsMap = new Map()
  DEFAULT_MF_FUNDS.forEach(f => allFundsMap.set(f.id, f))

  Object.keys(mfData).forEach(key => {
    if (!allFundsMap.has(key)) {
      const parsed = mfData[key]
      allFundsMap.set(key, {
        id: key,
        name: parsed.detected_fund_name || key,
        category: 'Custom / Detected',
        benchmark: parsed.returns_comparison?.benchmark_name || 'Benchmark Index'
      })
    }
  })

  const fundList = Array.from(allFundsMap.values())
  const selectedFund = fundList.find(f => f.id === selectedFundId)
  const currentData = selectedFund ? mfData[selectedFund.id] : null

  function handleClear(fundId, e) {
    e?.stopPropagation()
    if (confirm('Are you sure you want to clear the stored AI analysis for this fund?')) {
      dispatch({ type: 'CLEAR_MF_DATA', fundKey: fundId })
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'good':
        return { dot: 'bg-emerald-400', border: 'border-emerald-800/80', bg: 'bg-emerald-950/40', text: 'text-emerald-300' }
      case 'danger':
        return { dot: 'bg-rose-500', border: 'border-rose-800/80', bg: 'bg-rose-950/40', text: 'text-rose-300' }
      case 'warning':
        return { dot: 'bg-amber-400', border: 'border-amber-800/80', bg: 'bg-amber-950/40', text: 'text-amber-300' }
      case 'info':
      default:
        return { dot: 'bg-sky-400', border: 'border-sky-800/80', bg: 'bg-sky-950/40', text: 'text-sky-300' }
    }
  }

  const calculateReturnAlpha = (fundVal, benchVal) => {
    if (fundVal === null || fundVal === undefined || benchVal === null || benchVal === undefined) return null
    return Number((fundVal - benchVal).toFixed(2))
  }

  // Derive comprehensive investor verdict if not explicitly provided by backend
  const getDerivedVerdict = (data) => {
    if (!data) return null
    if (data.investor_verdict && data.investor_verdict.thesis) {
      return data.investor_verdict
    }

    const ret3y = data.returns_comparison?.three_year
    const alpha3y = calculateReturnAlpha(ret3y?.fund_cagr, ret3y?.benchmark_cagr)
    const terDirect = data.ter_direct_percentage
    const cash = data.cash_level_percentage
    const top10 = data.top_10_concentration_percentage
    const turnover = data.risk_metrics?.portfolio_turnover_ratio_percentage

    let action = 'SUITABLE FOR ALLOCATION'
    let actionStyle = 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
    const strengths = []
    const risks = []

    // Evaluate Alpha
    if (alpha3y !== null && alpha3y > 0) {
      strengths.push(`Solid 3-Year Outperformance: Generating +${alpha3y}% CAGR alpha above the benchmark (${ret3y.fund_cagr}% vs ${ret3y.benchmark_cagr}%).`)
    } else if (alpha3y !== null && alpha3y <= 0) {
      risks.push(`3-Year Underperformance: Trailing benchmark by ${Math.abs(alpha3y)}% CAGR over the rolling 3-year period.`)
    }

    // Evaluate TER
    if (terDirect !== null && terDirect !== undefined) {
      if (terDirect <= 0.6) {
        strengths.push(`Cost Efficiency: Low Direct TER of ${terDirect}% protects net compounding over long-term holding periods.`)
      } else if (terDirect > 1.1) {
        risks.push(`Expense Ratio: Direct TER of ${terDirect}% is relatively elevated for this category.`)
      }
    }

    // Evaluate Cash
    if (cash !== null && cash !== undefined) {
      if (cash > 8.0) {
        risks.push(`Cash Drag / Defensive Stance: High cash level at ${cash}% may drag returns during sustained bull market rallies.`)
      } else {
        strengths.push(`High Capital Deployment: Lean cash allocation (${cash}%) ensures funds are working in active holdings.`)
      }
    }

    // Evaluate Concentration
    if (top10 !== null && top10 !== undefined) {
      if (top10 > 50.0) {
        risks.push(`High Single-Stock Exposure: Top 10 holdings represent ${top10}% of the portfolio, elevating company-specific risk.`)
      } else {
        strengths.push(`Disciplined Diversification: Top 10 exposure capped at ${top10}%, mitigating drawdown vulnerability.`)
      }
    }

    // Evaluate Turnover
    if (turnover !== null && turnover !== undefined) {
      if (turnover > 100.0) {
        risks.push(`Portfolio Churning: Turnover ratio of ${turnover}% indicates frequent trading and potential transaction cost friction.`)
      } else {
        strengths.push(`Conviction Buy-and-Hold: Moderate turnover (${turnover}%) indicates patient management execution.`)
      }
    }

    // Determine Action
    if (risks.length >= 3 || (alpha3y !== null && alpha3y < -3.0)) {
      action = 'REVIEW / PROCEED WITH CAUTION'
      actionStyle = 'bg-rose-950/80 text-rose-400 border-rose-800'
    } else if (risks.length >= 2) {
      action = 'HOLD / MONITOR CLOSELY'
      actionStyle = 'bg-amber-950/80 text-amber-400 border-amber-800'
    }

    return {
      action,
      actionStyle,
      thesis: data.notes_or_highlights || `The fund maintains ${strengths.length > 0 ? strengths[0] : 'steady portfolio parameters'} with direct plan cost discipline.`,
      key_strengths: strengths.length > 0 ? strengths : ['Direct expense ratio protects compounding returns.', 'Holdings adhere to category mandate.'],
      key_risks_to_watch: risks.length > 0 ? risks : ['Monitor quarterly benchmark rolling CAGR consistency.', 'Track sector concentration changes.'],
      investor_takeaway: action === 'SUITABLE FOR ALLOCATION'
        ? `This fund qualifies for ongoing target weight allocations. Its risk-adjusted parameters support recurring weekly investment deployment.`
        : `Monitor the performance trajectory before increasing target allocation weight. Re-evaluate if rolling 3-year alpha fails to improve.`
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-mono font-bold text-neutral-400 uppercase tracking-widest">[05 MF DATA]</span>
            <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60">
              {Object.keys(mfData).length} / {fundList.length} Funds Audited
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white uppercase font-display tracking-wider mt-1">
            Mutual Fund Data Repository
          </h1>
          <p className="text-sm text-neutral-400 font-mono mt-1">
            Institutional Fact Sheet Analytics · Comprehensive Investor Due Diligence
          </p>
        </div>

        {selectedFund && (
          <button
            onClick={() => setSelectedFundId(null)}
            className="ather-btn-ghost px-5 py-2.5 text-sm font-mono font-bold"
          >
            ← Back to All Funds
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedFund ? (
          /* Grid View: Fund Cards matching FactSheets.jsx */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-8">
            {fundList.map((fund, idx) => {
              const data = mfData[fund.id]
              const hasData = !!data
              const alpha3y = data?.returns_comparison?.three_year 
                ? calculateReturnAlpha(data.returns_comparison.three_year.fund_cagr, data.returns_comparison.three_year.benchmark_cagr)
                : null

              return (
                <div
                  key={fund.id}
                  onClick={() => setSelectedFundId(fund.id)}
                  className={`ather-card border-neutral-800 bg-neutral-900/70 hover:bg-neutral-850 hover:border-neutral-700 transition-all cursor-pointer flex flex-col justify-between p-6 relative group ${
                    hasData ? 'border-neutral-700 shadow-lg' : 'opacity-90'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                          Fund {String(idx + 1).padStart(2, '0')} · {fund.category}
                        </span>
                      </div>
                      <div>
                        {hasData ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/70 border border-emerald-800/80 rounded text-xs font-mono text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>AUDITED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-neutral-800/70 border border-neutral-700/80 rounded text-xs font-mono text-neutral-400">
                            <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
                            <span>NO DATA</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-white font-bold text-lg mb-1 tracking-tight group-hover:text-emerald-400 transition-colors">
                      {fund.name}
                    </h3>
                    <div className="text-xs text-neutral-400 font-mono mb-3">
                      Benchmark: {data?.returns_comparison?.benchmark_name || fund.benchmark}
                    </div>

                    {/* Prominent Reporting Month Bar */}
                    {hasData && (
                      <div className="bg-neutral-950 p-2.5 rounded-lg border border-emerald-500/40 mb-3 flex items-center justify-between font-mono">
                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">REPORTING MONTH:</span>
                        <span className="text-sm font-black text-emerald-400 uppercase tracking-wide">
                          {data.as_of_date || 'LATEST'}
                        </span>
                      </div>
                    )}

                    {/* Quick Financial Metric Cards */}
                    {hasData ? (
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-neutral-800 font-mono">
                        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                          <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-0.5">Direct TER</span>
                          <span className="text-sm font-bold text-emerald-400">
                            {data.ter_direct_percentage !== null && data.ter_direct_percentage !== undefined ? `${data.ter_direct_percentage}%` : '-'}
                          </span>
                        </div>
                        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                          <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-0.5">AUM Size</span>
                          <span className="text-sm font-bold text-white">
                            {data.aum_in_crores ? `₹${Number(data.aum_in_crores).toLocaleString('en-IN')} Cr` : '-'}
                          </span>
                        </div>
                        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                          <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-0.5">Cash Level</span>
                          <span className={`text-sm font-bold ${Number(data.cash_level_percentage) > 7 ? 'text-amber-400' : 'text-neutral-200'}`}>
                            {data.cash_level_percentage !== null && data.cash_level_percentage !== undefined ? `${data.cash_level_percentage}%` : '-'}
                          </span>
                        </div>
                        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                          <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-0.5">3Y Alpha</span>
                          <span className={`text-sm font-bold ${alpha3y !== null ? (alpha3y >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-neutral-400'}`}>
                            {alpha3y !== null ? (alpha3y >= 0 ? `+${alpha3y}%` : `${alpha3y}%`) : '-'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-neutral-950/40 border border-dashed border-neutral-800 rounded-lg p-4 text-center text-xs font-mono text-neutral-400">
                        Screenshot analysis not performed yet
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="mt-5 pt-3.5 flex items-center justify-between gap-2 border-t border-neutral-800/80">
                    <button
                      className={`py-2.5 px-4 rounded-lg text-xs font-mono font-bold tracking-wider w-full transition-all text-center ${
                        hasData 
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {hasData ? 'VIEW MF DATA' : 'ANALYZE FACT SHEET'}
                    </button>
                    {hasData && (
                      <button
                        onClick={(e) => handleClear(fund.id, e)}
                        title="Clear Data"
                        className="px-3 py-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors text-xs font-mono"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Detail View: Clean Professional Institutional Fact Sheet Layout */
          <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Fund Top Control Bar */}
            <div className="p-5 bg-neutral-950 border-b border-neutral-800 flex flex-wrap justify-between items-center gap-4 shrink-0">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSelectedFundId(null)}
                  className="px-3.5 py-2 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 rounded-lg text-xs font-mono font-bold border border-neutral-700 transition-colors"
                >
                  ← All Funds
                </button>
                <div>
                  <h2 className="text-white font-extrabold text-xl sm:text-2xl tracking-tight">{selectedFund.name}</h2>
                  <div className="text-xs font-mono text-neutral-400 mt-0.5">
                    Category: <span className="text-neutral-200 font-semibold">{selectedFund.category}</span>
                  </div>
                </div>
              </div>

              {/* Prominent As-Of Badge in Top Bar */}
              <div className="flex items-center space-x-3">
                {currentData?.as_of_date && (
                  <div className="bg-neutral-900 border-2 border-emerald-500/60 px-4 py-2 rounded-xl flex items-center space-x-2.5 shadow-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <div>
                      <div className="text-[10px] font-mono uppercase font-bold text-neutral-400 tracking-wider">AS OF MONTH</div>
                      <div className="text-base sm:text-lg font-mono font-black text-emerald-400 tracking-wide uppercase">
                        {currentData.as_of_date}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => onNavigateToAnalyzer && onNavigateToAnalyzer(selectedFund.name)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold transition-all shadow-sm"
                >
                  Upload New Screenshots →
                </button>
                {currentData && (
                  <button
                    onClick={(e) => handleClear(selectedFund.id, e)}
                    className="px-3.5 py-2.5 bg-neutral-850 hover:bg-rose-950 hover:text-rose-300 text-neutral-400 rounded-lg text-xs font-mono border border-neutral-700 transition-colors"
                  >
                    Clear Stored Data
                  </button>
                )}
              </div>
            </div>

            {/* Fund Detail Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!currentData ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                  <div className="w-14 h-14 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-mono font-bold text-neutral-400 text-xl mb-4">
                    [05]
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">No AI Analysis Stored for this Fund</h3>
                  <p className="text-neutral-400 text-sm max-w-md font-mono mb-6 leading-relaxed">
                    Upload multi-page fact sheet screenshots in the AI Analyzer. The parsed financial parameters and investor verdict will be permanently stored under this fund.
                  </p>
                  <button
                    onClick={() => onNavigateToAnalyzer && onNavigateToAnalyzer(selectedFund.name)}
                    className="ather-btn-primary px-6 py-3 font-mono text-sm font-bold"
                  >
                    Open AI Analyzer for {selectedFund.name}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Large Factsheet As-Of Reporting Date Hero Banner */}
                  <div className="p-5 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border-2 border-emerald-500/50 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-4 h-4 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse"></div>
                      <div>
                        <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest">
                          FACTSHEET REPORTING PERIOD & AS-OF DATE
                        </div>
                        <div className="text-2xl sm:text-4xl font-mono font-black text-emerald-400 tracking-wider uppercase mt-1">
                          {currentData.as_of_date || 'LATEST AVAILABLE'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono bg-neutral-950/80 px-4 py-2.5 rounded-xl border border-neutral-800">
                      <div className="text-[11px] text-neutral-400 uppercase font-bold">SNAPSHOT STATUS</div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">
                        ACTIVE AUDIT RECORD
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Header Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <div className="text-xs uppercase font-bold text-neutral-400 font-mono">AUM (In Crores)</div>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-white mt-1">
                        {currentData.aum_in_crores ? `₹${Number(currentData.aum_in_crores).toLocaleString('en-IN')} Cr` : '-'}
                      </div>
                    </div>
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <div className="text-xs uppercase font-bold text-neutral-400 font-mono">Direct TER</div>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400 mt-1">
                        {currentData.ter_direct_percentage !== null && currentData.ter_direct_percentage !== undefined ? `${currentData.ter_direct_percentage}%` : '-'}
                      </div>
                    </div>
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <div className="text-xs uppercase font-bold text-neutral-400 font-mono">Cash & TREPS</div>
                      <div className={`text-2xl sm:text-3xl font-mono font-bold mt-1 ${Number(currentData.cash_level_percentage) > 7 ? 'text-amber-400' : 'text-neutral-200'}`}>
                        {currentData.cash_level_percentage !== null && currentData.cash_level_percentage !== undefined ? `${currentData.cash_level_percentage}%` : '-'}
                      </div>
                    </div>
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <div className="text-xs uppercase font-bold text-neutral-400 font-mono">Top 10 Exposure</div>
                      <div className={`text-2xl sm:text-3xl font-mono font-bold mt-1 ${Number(currentData.top_10_concentration_percentage) > 50 ? 'text-amber-400' : 'text-neutral-200'}`}>
                        {currentData.top_10_concentration_percentage !== null && currentData.top_10_concentration_percentage !== undefined ? `${currentData.top_10_concentration_percentage}%` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Automated Health & Risk Audit Flags */}
                  {currentData.diagnostic_flags && currentData.diagnostic_flags.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm font-mono font-bold text-neutral-400 uppercase tracking-wider">
                        <span>[Health & Risk Audit Parameters]</span>
                        <span className="text-xs bg-neutral-800 text-neutral-300 px-2.5 py-0.5 rounded-full font-bold">{currentData.diagnostic_flags.length} Checked</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {currentData.diagnostic_flags.map((flag, idx) => {
                          const badge = getStatusBadge(flag.status)
                          return (
                            <div key={idx} className={`p-4 rounded-xl border flex items-start space-x-3.5 ${badge.bg} ${badge.border}`}>
                              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${badge.dot}`}></span>
                              <div>
                                <div className="text-sm font-bold text-white font-mono tracking-tight">{flag.title}</div>
                                <div className="text-sm mt-1 text-neutral-200 leading-relaxed font-sans">{flag.message}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 1: Cost & Size */}
                  <div className="bg-neutral-950 rounded-xl p-6 border border-neutral-800 space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-emerald-400">
                        1. Cost & Fund Size Agility
                      </h3>
                      <span className="text-xs font-mono text-neutral-400">Expense Analysis</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                        <div className="text-xs font-mono text-neutral-400 uppercase font-bold mb-1">Direct Plan TER</div>
                        <div className="text-3xl font-mono font-bold text-emerald-400">
                          {currentData.ter_direct_percentage !== null && currentData.ter_direct_percentage !== undefined ? `${currentData.ter_direct_percentage}%` : '-'}
                        </div>
                        <div className="text-xs text-neutral-400 mt-2 font-sans">Lower expense ratio shields compounding.</div>
                      </div>

                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                        <div className="text-xs font-mono text-neutral-400 uppercase font-bold mb-1">Regular Plan TER</div>
                        <div className="text-3xl font-mono font-bold text-neutral-200">
                          {currentData.ter_regular_percentage !== null && currentData.ter_regular_percentage !== undefined ? `${currentData.ter_regular_percentage}%` : '-'}
                        </div>
                        {currentData.ter_direct_percentage && currentData.ter_regular_percentage && (
                          <div className="text-xs font-mono text-emerald-400 mt-2 font-bold">
                            Direct Plan delta: -{(currentData.ter_regular_percentage - currentData.ter_direct_percentage).toFixed(2)}%/yr
                          </div>
                        )}
                      </div>

                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                        <div className="text-xs font-mono text-neutral-400 uppercase font-bold mb-1">AUM Agility Rating</div>
                        <div className="text-3xl font-mono font-bold text-white">
                          {currentData.aum_in_crores ? `₹${Number(currentData.aum_in_crores).toLocaleString('en-IN')} Cr` : '-'}
                        </div>
                        <div className="text-xs text-neutral-400 mt-2 font-sans">Monitored for agility and overhead limits.</div>
                      </div>
                    </div>

                    {currentData.cost_and_size_verdict && (
                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-sm text-neutral-200 leading-relaxed font-sans">
                        <strong className="text-white font-mono uppercase text-xs mr-2 font-bold">[Agility Evaluation]:</strong>
                        {currentData.cost_and_size_verdict}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Portfolio Quality & Concentration */}
                  <div className="bg-neutral-950 rounded-xl p-6 border border-neutral-800 space-y-5">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-emerald-400">
                        2. Portfolio Quality & Holdings Concentration
                      </h3>
                      <span className="text-xs font-mono text-neutral-400">Single-Stock & Sector Dispersion</span>
                    </div>

                    {/* Gauges */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 space-y-3">
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-neutral-300 font-bold uppercase">Cash & Liquid Holdings</span>
                          <span className={`font-bold text-base ${Number(currentData.cash_level_percentage) > 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {currentData.cash_level_percentage !== null ? `${currentData.cash_level_percentage}%` : '-'}
                          </span>
                        </div>
                        <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800">
                          <div
                            className={`h-full rounded-full ${Number(currentData.cash_level_percentage) > 10 ? 'bg-rose-500' : Number(currentData.cash_level_percentage) > 7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (currentData.cash_level_percentage || 0) * 5)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-neutral-400 font-mono">
                          <span>0% (Lean)</span>
                          <span>7% Threshold</span>
                          <span>&gt;10% (Cash Drag)</span>
                        </div>
                      </div>

                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 space-y-3">
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-neutral-300 font-bold uppercase">Top 10 Holdings Weight</span>
                          <span className={`font-bold text-base ${Number(currentData.top_10_concentration_percentage) > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {currentData.top_10_concentration_percentage !== null ? `${currentData.top_10_concentration_percentage}%` : '-'}
                          </span>
                        </div>
                        <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800">
                          <div
                            className={`h-full rounded-full ${Number(currentData.top_10_concentration_percentage) > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, currentData.top_10_concentration_percentage || 0)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-neutral-400 font-mono">
                          <span>0% (Diversified)</span>
                          <span>50% Concentration Ceiling</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    {/* Holdings and Sectors */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Top Holdings */}
                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                        <div className="text-sm text-neutral-300 font-mono font-bold uppercase mb-4 flex justify-between">
                          <span>Holdings Breakdown ({currentData.top_holdings?.length || 0})</span>
                          <span>Weight</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                          {currentData.top_holdings && currentData.top_holdings.length > 0 ? (
                            currentData.top_holdings.map((h, i) => (
                              <div key={i} className="flex justify-between items-center text-sm py-2 px-2.5 rounded hover:bg-neutral-950 border-b border-neutral-800/50 last:border-0 font-mono">
                                <div className="truncate pr-3">
                                  <span className="text-neutral-400 mr-2 text-xs">{i + 1}.</span>
                                  <span className="text-neutral-100 font-medium font-sans">{h.company_name}</span>
                                  {h.sector && <span className="text-xs text-neutral-400 block ml-5 mt-0.5">{h.sector}</span>}
                                </div>
                                <span className="text-white font-bold shrink-0 text-sm">{h.weight_percentage}%</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-400 text-sm py-4 text-center font-mono">No holding data extracted.</div>
                          )}
                        </div>
                      </div>

                      {/* Sector Allocation */}
                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                        <div className="text-sm text-neutral-300 font-mono font-bold uppercase mb-4 flex justify-between">
                          <span>Sector Distribution ({currentData.sector_allocation?.length || 0})</span>
                          <span>Weight</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                          {currentData.sector_allocation && currentData.sector_allocation.length > 0 ? (
                            currentData.sector_allocation.map((s, i) => (
                              <div key={i} className="space-y-1.5 font-mono">
                                <div className="flex justify-between text-sm">
                                  <span className="text-neutral-200 truncate pr-2 font-sans">{s.sector_name}</span>
                                  <span className="text-white font-bold">{s.weight_percentage}%</span>
                                </div>
                                <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full"
                                    style={{ width: `${Math.min(100, s.weight_percentage * 2)}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-400 text-sm py-4 text-center font-mono">No sector data extracted.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Benchmark Performance */}
                  <div className="bg-neutral-950 rounded-xl p-6 border border-neutral-800 space-y-5">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-emerald-400">
                        3. Benchmark Discipline & CAGR Returns
                      </h3>
                      <span className="text-xs font-mono text-neutral-400">
                        Benchmark: {currentData.returns_comparison?.benchmark_name || selectedFund.benchmark}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm font-mono">
                        <thead>
                          <tr className="border-b border-neutral-800 text-neutral-400 uppercase text-xs">
                            <th className="py-3 px-4">Horizon</th>
                            <th className="py-3 px-4">Fund CAGR</th>
                            <th className="py-3 px-4">Benchmark CAGR</th>
                            <th className="py-3 px-4">Alpha</th>
                            <th className="py-3 px-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-850">
                          {[
                            { period: '1 Year', data: currentData.returns_comparison?.one_year },
                            { period: '3 Years (Key)', data: currentData.returns_comparison?.three_year, highlight: true },
                            { period: '5 Years (Key)', data: currentData.returns_comparison?.five_year, highlight: true },
                            { period: 'Since Inception', data: currentData.returns_comparison?.since_inception }
                          ].map((row, i) => {
                            const fundVal = row.data?.fund_cagr
                            const benchVal = row.data?.benchmark_cagr
                            const alpha = calculateReturnAlpha(fundVal, benchVal)

                            return (
                              <tr key={i} className={`hover:bg-neutral-900/60 ${row.highlight ? 'bg-neutral-900/40' : ''}`}>
                                <td className="py-3.5 px-4 font-bold text-neutral-100 text-sm">
                                  {row.period}
                                  {row.highlight && <span className="ml-2 text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded font-mono font-bold">ROLLING</span>}
                                </td>
                                <td className="py-3.5 px-4 text-white font-bold text-base">
                                  {fundVal !== null && fundVal !== undefined ? `${fundVal}%` : '-'}
                                </td>
                                <td className="py-3.5 px-4 text-neutral-300 text-base">
                                  {benchVal !== null && benchVal !== undefined ? `${benchVal}%` : '-'}
                                </td>
                                <td className="py-3.5 px-4">
                                  {alpha !== null ? (
                                    <span className={`font-bold px-2.5 py-1 rounded text-xs ${alpha >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                                      {alpha >= 0 ? `+${alpha}%` : `${alpha}%`}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600">-</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {alpha !== null ? (
                                    <span className={`text-xs font-bold ${alpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {alpha >= 0 ? 'Outperforming' : 'Lagging Index'}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600">-</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 flex justify-between items-center">
                        <div>
                          <div className="text-xs text-neutral-400 font-mono uppercase font-bold">Turnover Ratio</div>
                          <div className="text-xs text-neutral-400 font-mono mt-0.5">Churning drag ceiling: 100%</div>
                        </div>
                        <div className={`text-lg font-mono font-bold ${Number(currentData.risk_metrics?.portfolio_turnover_ratio_percentage) > 100 ? 'text-rose-400' : 'text-white'}`}>
                          {currentData.risk_metrics?.portfolio_turnover_ratio_percentage !== null && currentData.risk_metrics?.portfolio_turnover_ratio_percentage !== undefined ? `${currentData.risk_metrics.portfolio_turnover_ratio_percentage}%` : '-'}
                        </div>
                      </div>

                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 flex justify-between items-center">
                        <div>
                          <div className="text-xs text-neutral-400 font-mono uppercase font-bold">Tracking Error</div>
                          <div className="text-xs text-neutral-400 font-mono mt-0.5">Index replication error</div>
                        </div>
                        <div className="text-lg font-mono font-bold text-emerald-400">
                          {currentData.risk_metrics?.tracking_error_percentage !== null && currentData.risk_metrics?.tracking_error_percentage !== undefined ? `${currentData.risk_metrics.tracking_error_percentage}%` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Risk & Volatility Metrics */}
                  <div className="bg-neutral-950 rounded-xl p-6 border border-neutral-800 space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-emerald-400">
                        4. Risk Parameters & Volatility Metrics
                      </h3>
                      <span className="text-xs font-mono text-neutral-400">Sharpe, Beta & Debt Attributes</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 font-mono">
                        <div className="text-xs text-neutral-400 uppercase font-bold mb-1">Sharpe Ratio</div>
                        <div className="text-2xl font-bold text-emerald-400">
                          {currentData.risk_metrics?.sharpe_ratio !== null && currentData.risk_metrics?.sharpe_ratio !== undefined ? currentData.risk_metrics.sharpe_ratio : '-'}
                        </div>
                        <div className="text-xs text-neutral-400 mt-1 font-sans">Risk-adjusted return</div>
                      </div>

                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 font-mono">
                        <div className="text-xs text-neutral-400 uppercase font-bold mb-1">Market Beta</div>
                        <div className={`text-2xl font-bold ${Number(currentData.risk_metrics?.beta) > 1.05 ? 'text-amber-400' : 'text-white'}`}>
                          {currentData.risk_metrics?.beta !== null && currentData.risk_metrics?.beta !== undefined ? currentData.risk_metrics.beta : '-'}
                        </div>
                        <div className="text-xs text-neutral-400 mt-1 font-sans">&gt; 1 = Higher volatility</div>
                      </div>

                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 font-mono">
                        <div className="text-xs text-neutral-400 uppercase font-bold mb-1">Standard Dev.</div>
                        <div className="text-2xl font-bold text-white">
                          {currentData.risk_metrics?.standard_deviation_percentage !== null && currentData.risk_metrics?.standard_deviation_percentage !== undefined ? `${currentData.risk_metrics.standard_deviation_percentage}%` : '-'}
                        </div>
                        <div className="text-xs text-neutral-400 mt-1 font-sans">Annualized volatility</div>
                      </div>

                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 font-mono">
                        <div className="text-xs text-neutral-400 uppercase font-bold mb-1">Yield to Maturity</div>
                        <div className="text-2xl font-bold text-sky-400">
                          {currentData.debt_metrics?.ytm_percentage !== null && currentData.debt_metrics?.ytm_percentage !== undefined ? `${currentData.debt_metrics.ytm_percentage}%` : '-'}
                        </div>
                        <div className="text-xs text-neutral-400 mt-1 font-sans">Debt portfolio yield</div>
                      </div>
                    </div>

                    {/* Debt & Credit Quality Breakdown (if debt fund) */}
                    {currentData.debt_metrics && (currentData.debt_metrics.modified_duration_years_or_days || currentData.debt_metrics.credit_quality) && (
                      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 space-y-3">
                        <div className="text-xs font-mono font-bold uppercase text-neutral-300">
                          Debt & Credit Quality Allocation
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-mono">
                          <div>
                            <span className="text-neutral-400 text-xs block mb-0.5">MOD. DURATION</span>
                            <span className="text-white font-bold">{currentData.debt_metrics.modified_duration_years_or_days || '-'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 text-xs block mb-0.5">AVG. MATURITY</span>
                            <span className="text-white font-bold">{currentData.debt_metrics.average_maturity_years_or_days || '-'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 text-xs block mb-0.5">SOVEREIGN / AAA</span>
                            <span className="text-emerald-400 font-bold">
                              {currentData.debt_metrics.credit_quality?.sovereign_percentage || currentData.debt_metrics.credit_quality?.aaa_percentage 
                                ? `${(Number(currentData.debt_metrics.credit_quality?.sovereign_percentage || 0) + Number(currentData.debt_metrics.credit_quality?.aaa_percentage || 0)).toFixed(1)}%` 
                                : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-400 text-xs block mb-0.5">A1+ / CASH</span>
                            <span className="text-white font-bold">
                              {currentData.debt_metrics.credit_quality?.a1_plus_percentage || currentData.debt_metrics.credit_quality?.cash_and_equivalent_percentage 
                                ? `${currentData.debt_metrics.credit_quality?.a1_plus_percentage || currentData.debt_metrics.credit_quality?.cash_and_equivalent_percentage}%` 
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 5: Fund Management */}
                  <div className="bg-neutral-950 rounded-xl p-6 border border-neutral-800 space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-emerald-400">
                        5. Fund Management & Track Record Consistency
                      </h3>
                      <span className="text-xs font-mono text-neutral-400">Tenure Governance</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentData.fund_managers && currentData.fund_managers.length > 0 ? (
                        currentData.fund_managers.map((m, i) => (
                          <div key={i} className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 flex items-start space-x-3.5">
                            <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm text-neutral-200 font-mono font-bold shrink-0">
                              {m.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-white font-bold text-base font-sans">{m.name}</div>
                              <div className="text-emerald-400 text-xs font-mono mt-0.5 font-bold">{m.tenure || 'Tenure not specified'}</div>
                              {m.experience_or_role && <div className="text-neutral-300 text-xs font-sans mt-1 leading-normal">{m.experience_or_role}</div>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-neutral-400 text-sm py-2 font-mono">No fund manager records found.</div>
                      )}
                    </div>
                  </div>

                  {/* Section 6: Comprehensive Investor Actionable Verdict & Due Diligence Thesis */}
                  {(() => {
                    const verdict = getDerivedVerdict(currentData)
                    if (!verdict) return null

                    return (
                      <div className="bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 rounded-xl p-6 border-2 border-emerald-800/70 shadow-2xl space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                          <div>
                            <div className="text-xs font-mono uppercase font-bold text-neutral-400 tracking-widest">[FACTSHEET AUDIT SUMMARY]</div>
                            <h3 className="text-lg font-extrabold text-white uppercase font-display tracking-wider mt-0.5">
                              Investor Actionable Verdict & Thesis
                            </h3>
                          </div>
                          <div>
                            <span className={`inline-block px-3.5 py-1.5 rounded-lg text-xs font-mono font-extrabold border ${verdict.actionStyle || 'bg-emerald-950 text-emerald-400 border-emerald-800'}`}>
                              VERDICT: {verdict.action}
                            </span>
                          </div>
                        </div>

                        {/* Core Investment Thesis */}
                        <div className="bg-neutral-900/90 p-4 rounded-xl border border-neutral-800">
                          <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                            Core Investment Thesis
                          </div>
                          <p className="text-sm text-neutral-100 font-sans leading-relaxed">
                            {verdict.thesis}
                          </p>
                        </div>

                        {/* Strengths and Risks Columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Strengths */}
                          <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/40 space-y-2.5">
                            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                              <span>Key Investment Strengths (Why Consider)</span>
                            </div>
                            <ul className="space-y-2 text-sm text-neutral-200 font-sans">
                              {verdict.key_strengths.map((str, idx) => (
                                <li key={idx} className="flex items-start space-x-2">
                                  <span className="text-emerald-400 font-bold font-mono shrink-0">+</span>
                                  <span className="leading-snug">{str}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Risks / Watchpoints */}
                          <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-900/40 space-y-2.5">
                            <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                              <span>Key Risks & Watchpoints (What to Monitor)</span>
                            </div>
                            <ul className="space-y-2 text-sm text-neutral-200 font-sans">
                              {verdict.key_risks_to_watch.map((r, idx) => (
                                <li key={idx} className="flex items-start space-x-2">
                                  <span className="text-amber-400 font-bold font-mono shrink-0">!</span>
                                  <span className="leading-snug">{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Recommendation for Portfolio Allocation */}
                        <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800">
                          <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            Weekly Allocation Rule & Portfolio Guidance
                          </div>
                          <p className="text-sm text-neutral-200 font-sans leading-relaxed">
                            {verdict.investor_takeaway}
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
