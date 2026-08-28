import FactSheetUploader from '../components/FactSheetUploader'

export default function AiAnalyzer({ onNavigateToMfData, preselectedFund }) {
  const funds = [
    { name: 'HDFC Nifty 50 Index Fund' },
    { name: 'Nippon India Growth Fund' },
    { name: 'Edelweiss Small Cap Fund' },
    { name: 'Edelweiss US Technology Equity FOF' },
    { name: 'Edelweiss Greater China Equity Off-shore Fund' },
    { name: 'Axis Liquid Fund' }
  ]

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest">[04 AI ANALYZER]</div>
          <h1 className="text-2xl font-bold text-white uppercase font-display tracking-wider mt-0.5">AI Fact Sheet Analyzer</h1>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">Multi-screenshot vision AI parsing pipeline · Automatically writes to [05 MF DATA]</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <FactSheetUploader 
          funds={funds} 
          onNavigateToMfData={onNavigateToMfData}
          preselectedFund={preselectedFund}
        />
      </div>
    </div>
  )
}
