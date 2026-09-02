import { useState } from 'react'

export default function FactSheets() {
  const funds = [
    { name: 'HDFC Nifty 50 Index Fund', url: 'https://www.hdfcfund.com/factsheet/hdfc-nifty-50-index-fund.pdf' },
    { name: 'Nippon India Growth Fund', url: 'https://mf.nipponindiaim.com/investor-service/downloads/factsheet-portfolio-and-other-disclosures' },
    { name: 'Edelweiss Small Cap Fund', url: 'https://www.edelweissmf.com/downloads/factsheets' },
    { name: 'Axis Liquid Fund', url: 'https://www.axismf.com/downloads/products' }
  ]

  const [selectedPdf, setSelectedPdf] = useState(null)

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase font-display tracking-wider">Fund Fact Sheets</h1>
          <p className="text-sm text-neutral-400 font-mono mt-1">Direct PDF Viewer for Mutual Fund Fact Sheets</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedPdf ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
            {funds.map((fund, idx) => (
              <div
                key={idx}
                className="ather-card border-neutral-800 bg-neutral-900/50 flex flex-col justify-between hover:bg-neutral-800/80 transition-colors cursor-pointer"
                onClick={() => setSelectedPdf(fund.url)}
              >
                <div>
                  <div className="text-xs font-mono text-neutral-500 mb-2">Fund {idx + 1}</div>
                  <h3 className="text-white font-bold mb-4">{fund.name}</h3>
                </div>
                <button 
                  className="ather-btn-primary py-2 w-full mt-4"
                >
                  VIEW FACT SHEET
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden h-[75vh]">
            <div className="flex justify-between items-center p-4 bg-neutral-950 border-b border-neutral-800 shrink-0">
              <h3 className="text-white font-bold">{funds.find(f => f.url === selectedPdf)?.name || 'Fact Sheet'}</h3>
              <div className="flex space-x-3">
                <a 
                  href={selectedPdf} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-neutral-400 hover:text-white px-3 py-1.5 bg-neutral-800 rounded text-sm flex items-center transition-colors"
                >
                  Open in New Tab
                </a>
                <button 
                  onClick={() => setSelectedPdf(null)} 
                  className="text-neutral-400 hover:text-white px-3 py-1.5 bg-neutral-800 rounded text-sm transition-colors"
                >
                  Close Viewer
                </button>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <iframe 
                src={selectedPdf} 
                className="absolute inset-0 w-full h-full"
                title="PDF Viewer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



