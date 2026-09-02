import { useState, useEffect, useRef, useCallback } from 'react';
import { usePortfolio } from '../store/portfolioStore';
import { normalizeFundKey } from '../pages/MfData';
import {
  analyzeFactSheetWithVision,
  getStoredProvider,
  getStoredApiKey,
} from '../utils/aiVision';
import AiSettingsModal from './AiSettingsModal';

export default function FactSheetUploader({ funds, onNavigateToMfData, preselectedFund }) {
  const { dispatch } = usePortfolio();
  const [images, setImages] = useState([]);
  const [targetFund, setTargetFund] = useState(preselectedFund || 'auto');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [savedFundKey, setSavedFundKey] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentProvider, setCurrentProvider] = useState(getStoredProvider());
  const [hasApiKey, setHasApiKey] = useState(Boolean(getStoredApiKey()));
  const fileInputRef = useRef(null);

  const refreshAiStatus = useCallback(() => {
    const p = getStoredProvider();
    setCurrentProvider(p);
    setHasApiKey(Boolean(getStoredApiKey(p)));
  }, []);

  useEffect(() => {
    refreshAiStatus();
  }, [refreshAiStatus]);

  useEffect(() => {
    if (preselectedFund) {
      setTargetFund(preselectedFund);
    }
  }, [preselectedFund]);

  // Handle clipboard pasting globally when this component is mounted
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const newImages = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          newImages.push(file);
        }
      }
      
      if (newImages.length > 0) {
        addFiles(newImages);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const addFiles = useCallback((files) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    const newImageObjs = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file: file,
      preview: URL.createObjectURL(file)
    }));

    setImages(prev => [...prev, ...newImageObjs]);
  }, []);

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (id) => {
    setImages(prev => {
      const idx = prev.findIndex(img => img.id === id);
      if (idx !== -1) URL.revokeObjectURL(prev[idx].preview);
      return prev.filter(img => img.id !== id);
    });
  };

  const moveImage = (index, direction) => {
    setImages(prev => {
      const newImages = [...prev];
      if (direction === 'up' && index > 0) {
        [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      } else if (direction === 'down' && index < newImages.length - 1) {
        [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index + 1]];
      }
      return newImages;
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setResults(null);
    setSavedFundKey(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;

    // Check if API key is configured
    const key = getStoredApiKey();
    if (!key) {
      setIsSettingsOpen(true);
      setError('Please provide a Google Gemini or Groq API key to analyze in the browser.');
      return;
    }
    
    setAnalyzing(true);
    setError(null);
    setResults(null);
    setSavedFundKey(null);

    try {
      const rawFiles = images.map(img => img.file);
      const data = await analyzeFactSheetWithVision({
        files: rawFiles,
        targetFund,
      });

      setResults(data);

      // Automatically write and persist the data to the matching fund in 05 MF Data
      const keyName = targetFund !== 'auto' 
        ? targetFund 
        : (data.matched_portfolio_fund && data.matched_portfolio_fund !== 'Other' ? data.matched_portfolio_fund : data.detected_fund_name);
      
      const fundKey = normalizeFundKey(keyName);
      setSavedFundKey(fundKey);

      dispatch({
        type: 'SAVE_MF_DATA',
        fundKey: fundKey,
        data: data,
      });
    } catch (err) {
      if (err.message === 'NO_API_KEY_CONFIGURED') {
        setIsSettingsOpen(true);
        setError('Please configure your Gemini or Groq API key.');
      } else {
        setError(err.message);
      }
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const getFlagBadge = (status) => {
    switch (status) {
      case 'good':
        return {
          bg: 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300',
          dot: 'bg-emerald-400',
        };
      case 'danger':
        return {
          bg: 'bg-rose-950/40 border-rose-800/80 text-rose-300',
          dot: 'bg-rose-500',
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/40 border-amber-800/80 text-amber-300',
          dot: 'bg-amber-400',
        };
      case 'info':
      default:
        return {
          bg: 'bg-sky-950/40 border-sky-800/80 text-sky-300',
          dot: 'bg-sky-400',
        };
    }
  };

  const calculateReturnAlpha = (fundVal, benchVal) => {
    if (fundVal === null || fundVal === undefined || benchVal === null || benchVal === undefined) return null;
    return Number((fundVal - benchVal).toFixed(2));
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      {/* Top Bar Header */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-950 flex flex-wrap gap-3 justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <h2 className="text-white font-bold tracking-wide uppercase text-xs font-mono">Fact Sheet Multi-Page Vision Analyzer</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all flex items-center gap-1.5 ${
              hasApiKey
                ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-amber-950/40 border-amber-500/60 text-amber-300 hover:bg-amber-900/60 animate-pulse'
            }`}
            title="Configure Vision AI Provider & API Key"
          >
            <span>{hasApiKey ? '⚡' : '⚙️'}</span>
            <span className="font-bold uppercase tracking-wider">
              {hasApiKey ? `${currentProvider === 'gemini' ? 'Gemini' : 'Groq'} Ready` : 'Configure AI Key'}
            </span>
          </button>

          <select 
            value={targetFund} 
            onChange={e => setTargetFund(e.target.value)}
            className="bg-neutral-800 text-white text-xs border border-neutral-700 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500 font-mono"
          >
            <option value="auto">Auto-Detect Fund</option>
            {funds.map((f, i) => (
              <option key={i} value={f.name}>{f.name}</option>
            ))}
          </select>
          <button 
            onClick={clearAll}
            className="text-neutral-400 hover:text-white px-3 py-1.5 text-xs bg-neutral-800/50 hover:bg-neutral-800 rounded-lg border border-neutral-700/50 transition-colors font-mono"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Side: Screenshot Uploader & Staging Gallery */}
        <div className="w-full md:w-[42%] lg:w-[38%] border-r border-neutral-800 flex flex-col p-4 overflow-y-auto bg-neutral-900/60">
          <div 
            className="border-2 border-dashed border-neutral-700/80 hover:border-emerald-500/80 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-neutral-950/60 hover:bg-neutral-900/80 transition-all cursor-pointer mb-4"
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = null;
              }}
            />
            <div className="w-10 h-10 rounded-lg bg-neutral-850 border border-neutral-700 flex items-center justify-center text-xs font-mono font-bold mb-3 text-emerald-400">
              IMG
            </div>
            <h3 className="text-white font-bold text-sm mb-1">Upload Fact Sheet Pages</h3>
            <p className="text-neutral-400 text-xs max-w-xs mb-2">Drop screenshots or press <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded border border-neutral-700 text-[10px] font-mono">Ctrl+V</kbd> to paste</p>
            <span className="text-[11px] text-neutral-400 font-mono">Supports all AMC fact sheet layouts</span>
          </div>

          {images.length > 0 && (
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
                <span className="font-bold uppercase tracking-wider text-neutral-300">Staged Pages ({images.length})</span>
                <span className="text-[11px] text-neutral-400">Reorder with ↑ ↓</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {images.map((img, idx) => (
                  <div key={img.id} className="relative group bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800">
                    <img src={img.preview} alt={`Page ${idx + 1}`} className="w-full h-28 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-1.5 left-1.5 bg-black/90 px-2 py-0.5 text-[10px] text-white font-mono rounded">
                      P{idx + 1}
                    </div>
                    
                    {/* Controls Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2 transition-opacity">
                      <div className="flex justify-end">
                        <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="bg-rose-600 hover:bg-rose-500 text-white rounded w-5 h-5 flex items-center justify-center text-[10px]">✕</button>
                      </div>
                      <div className="flex justify-between items-center">
                         <button onClick={(e) => { e.stopPropagation(); moveImage(idx, 'up'); }} disabled={idx === 0} className="bg-neutral-800 hover:bg-neutral-700 text-white rounded w-5 h-5 flex items-center justify-center text-[10px] disabled:opacity-30">↑</button>
                         <button onClick={(e) => { e.stopPropagation(); moveImage(idx, 'down'); }} disabled={idx === images.length - 1} className="bg-neutral-800 hover:bg-neutral-700 text-white rounded w-5 h-5 flex items-center justify-center text-[10px] disabled:opacity-30">↓</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-neutral-800">
            <button 
              onClick={handleAnalyze}
              disabled={images.length === 0 || analyzing}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center text-xs font-mono tracking-wider"
            >
              {analyzing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  PARSING {images.length} PAGES...
                </span>
              ) : `ANALYZE ${images.length > 0 ? images.length + ' PAGES' : 'FACT SHEET'}`}
            </button>
            {error && (
              <div className="mt-2 text-rose-400 text-xs text-center font-mono bg-rose-950/40 border border-rose-800/50 py-2 px-3 rounded-lg">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Comprehensive Analytics Dashboard */}
        <div className="flex-1 bg-neutral-950 flex flex-col overflow-hidden">
          {/* Result View Filter Tabs */}
          {results && (
            <div className="border-b border-neutral-800 px-4 py-2 bg-neutral-950 flex items-center justify-between overflow-x-auto shrink-0 gap-2">
              <div className="flex space-x-1.5">
                {[
                  { id: 'all', label: 'Overview & Flags' },
                  { id: 'cost_quality', label: 'Cost & Portfolio Quality' },
                  { id: 'performance', label: 'Benchmark Returns' },
                  { id: 'risk_debt', label: 'Risk & Debt Metrics' },
                  { id: 'managers', label: 'Management' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
                      activeTab === tab.id 
                        ? 'bg-emerald-600 text-white font-bold' 
                        : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-mono text-neutral-400 whitespace-nowrap">As of: {results.as_of_date || 'Latest'}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            {!results && !analyzing && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-mono text-neutral-400 mb-4 font-bold">
                  [04]
                </div>
                <h3 className="text-white font-bold text-base mb-2">No Analysis Loaded Yet</h3>
                <p className="text-neutral-400 text-xs max-w-md mb-6 leading-relaxed font-mono">
                  Upload screenshot pages of your mutual fund fact sheet. The AI engine extracts Direct TER, AUM agility, Top 10 concentration, Cash drag, 3Y/5Y benchmark returns, Turnover, Sharpe, Beta, and Fund Manager tenure.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-w-lg text-left text-[11px] font-mono">
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">Cash Drag Audit</div>
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">Top 10 Concentration</div>
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">3Y / 5Y Benchmark Alpha</div>
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">Direct TER Expense Shield</div>
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">Turnover Churn Flag</div>
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">Sharpe & Beta Audit</div>
                </div>
              </div>
            )}

            {analyzing && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4"></div>
                <h3 className="text-emerald-400 font-mono text-xs font-bold tracking-wider mb-2 uppercase">EXTRACTING METRICS & WRITING TO 05 MF DATA...</h3>
                <p className="text-neutral-400 text-xs max-w-sm font-mono">Consolidating portfolio holdings, calculating benchmark alpha, and scanning risk parameters.</p>
              </div>
            )}

            {results && (
              <div className="space-y-6">
                {/* Notification Banner: Data successfully written to 05 MF Data */}
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center space-x-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <div>
                      <div className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wide">
                        Analysis Automatically Written to 05 MF Data
                      </div>
                      <div className="text-xs text-neutral-300 mt-0.5">
                        Saved under fund profile: <strong className="text-white font-mono">{results.matched_portfolio_fund || results.detected_fund_name}</strong>
                      </div>
                    </div>
                  </div>
                  {onNavigateToMfData && (
                    <button
                      onClick={() => onNavigateToMfData(savedFundKey)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold transition-all shadow-sm flex items-center space-x-1"
                    >
                      <span>VIEW IN 05 MF DATA →</span>
                    </button>
                  )}
                </div>

                {/* 1. Header Card with Fund Identity */}
                <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 shadow-md">
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded">
                          Fact Sheet Analysis
                        </span>
                        <span className="text-[11px] font-mono text-neutral-400">
                          Matched: <span className="text-white font-medium">{results.matched_portfolio_fund}</span>
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-wide">{results.detected_fund_name}</h2>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-[10px] text-neutral-400 uppercase font-bold font-mono">As of Date</div>
                        <div className="text-emerald-400 font-mono text-sm font-bold">{results.as_of_date || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Quick Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800">
                    <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono">AUM (In Crores)</div>
                      <div className="text-base font-mono font-bold text-white">
                        {results.aum_in_crores ? `₹${Number(results.aum_in_crores).toLocaleString('en-IN')}` : '-'}
                      </div>
                    </div>
                    <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono">Direct TER</div>
                      <div className="text-base font-mono font-bold text-emerald-400">
                        {results.ter_direct_percentage !== null && results.ter_direct_percentage !== undefined ? `${results.ter_direct_percentage}%` : '-'}
                      </div>
                    </div>
                    <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono">Cash & TREPS</div>
                      <div className={`text-base font-mono font-bold ${Number(results.cash_level_percentage) > 7 ? 'text-amber-400' : 'text-neutral-200'}`}>
                        {results.cash_level_percentage !== null && results.cash_level_percentage !== undefined ? `${results.cash_level_percentage}%` : '-'}
                      </div>
                    </div>
                    <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono">Top 10 Exposure</div>
                      <div className={`text-base font-mono font-bold ${Number(results.top_10_concentration_percentage) > 50 ? 'text-amber-400' : 'text-neutral-200'}`}>
                        {results.top_10_concentration_percentage !== null && results.top_10_concentration_percentage !== undefined ? `${results.top_10_concentration_percentage}%` : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Automated Diagnostic Flags */}
                {(activeTab === 'all' || activeTab === 'cost_quality' || activeTab === 'performance' || activeTab === 'risk_debt') && results.diagnostic_flags && results.diagnostic_flags.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">[Automated Health & Risk Audits]</span>
                      <span className="text-[10px] bg-neutral-800 text-neutral-300 font-mono px-2 py-0.5 rounded-full">{results.diagnostic_flags.length} checks</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {results.diagnostic_flags.map((flag, idx) => {
                        const style = getFlagBadge(flag.status);
                        return (
                          <div key={idx} className={`p-3 rounded-lg border flex items-start space-x-2.5 ${style.bg}`}>
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`}></span>
                            <div>
                              <div className="text-xs font-bold text-white font-mono flex items-center space-x-1.5">
                                <span>{flag.title}</span>
                              </div>
                              <div className="text-xs mt-0.5 text-neutral-300 leading-relaxed font-sans">{flag.message}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Cost & Size Section */}
                {(activeTab === 'all' || activeTab === 'cost_quality') && (
                  <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider">
                        1. Cost & Fund Size Agility
                      </h3>
                      <span className="text-[11px] text-neutral-400 font-mono">Compounding Shield</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                        <div className="text-xs text-neutral-400 font-mono uppercase font-bold mb-1">Direct Plan TER</div>
                        <div className="text-2xl font-mono font-bold text-emerald-400">
                          {results.ter_direct_percentage !== null && results.ter_direct_percentage !== undefined ? `${results.ter_direct_percentage}%` : '-'}
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-1">Lower TER protects compounding.</div>
                      </div>

                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                        <div className="text-xs text-neutral-400 font-mono uppercase font-bold mb-1">Regular Plan TER</div>
                        <div className="text-2xl font-mono font-bold text-neutral-300">
                          {results.ter_regular_percentage !== null && results.ter_regular_percentage !== undefined ? `${results.ter_regular_percentage}%` : '-'}
                        </div>
                        {results.ter_direct_percentage && results.ter_regular_percentage && (
                          <div className="text-[11px] text-emerald-400 mt-1 font-mono">
                            Direct Plan delta: -{(results.ter_regular_percentage - results.ter_direct_percentage).toFixed(2)}%/yr
                          </div>
                        )}
                      </div>

                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                        <div className="text-xs text-neutral-400 font-mono uppercase font-bold mb-1">AUM Scale</div>
                        <div className="text-2xl font-mono font-bold text-white">
                          {results.aum_in_crores ? `₹${Number(results.aum_in_crores).toLocaleString('en-IN')} Cr` : '-'}
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-1">Monitored for agility and overhead.</div>
                      </div>
                    </div>

                    {results.cost_and_size_verdict && (
                      <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 text-xs text-neutral-300 font-sans">
                        <strong className="text-white font-mono uppercase text-[11px] mr-2">Evaluation:</strong>
                        {results.cost_and_size_verdict}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Portfolio Quality & Holdings Section */}
                {(activeTab === 'all' || activeTab === 'cost_quality') && (
                  <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider">
                        2. Portfolio Quality & Diversification
                      </h3>
                      <span className="text-[11px] text-neutral-400 font-mono">Concentration Audit</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cash Level */}
                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-400 font-mono font-bold uppercase">Cash & Liquid Holdings</span>
                          <span className={`font-mono font-bold text-sm ${Number(results.cash_level_percentage) > 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {results.cash_level_percentage !== null ? `${results.cash_level_percentage}%` : '-'}
                          </span>
                        </div>
                        <div className="w-full bg-neutral-850 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${Number(results.cash_level_percentage) > 10 ? 'bg-rose-500' : Number(results.cash_level_percentage) > 7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (results.cash_level_percentage || 0) * 5)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                          <span>0% (Lean)</span>
                          <span>7% Threshold</span>
                          <span>&gt;10% (Cash Drag)</span>
                        </div>
                      </div>

                      {/* Top 10 Concentration */}
                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-400 font-mono font-bold uppercase">Top 10 Holdings Weight</span>
                          <span className={`font-mono font-bold text-sm ${Number(results.top_10_concentration_percentage) > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {results.top_10_concentration_percentage !== null ? `${results.top_10_concentration_percentage}%` : '-'}
                          </span>
                        </div>
                        <div className="w-full bg-neutral-850 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${Number(results.top_10_concentration_percentage) > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, results.top_10_concentration_percentage || 0)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                          <span>0% (Diversified)</span>
                          <span>50% Concentration Ceiling</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Top Holdings Table */}
                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                        <div className="text-xs text-neutral-400 font-bold uppercase font-mono mb-3 flex justify-between items-center">
                          <span>Top Holdings ({results.top_holdings?.length || 0})</span>
                          <span className="text-[10px] text-neutral-400">Weight</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5">
                          {results.top_holdings && results.top_holdings.length > 0 ? (
                            results.top_holdings.map((h, i) => (
                              <div key={i} className="flex justify-between items-center text-xs py-1.5 px-2 rounded hover:bg-neutral-900 border-b border-neutral-800/40 last:border-0 font-mono">
                                <div className="truncate pr-2">
                                  <span className="text-neutral-400 mr-2 text-[10px]">{i + 1}.</span>
                                  <span className="text-neutral-200 font-medium font-sans">{h.company_name}</span>
                                  {h.sector && <span className="text-[10px] text-neutral-400 block ml-5">{h.sector}</span>}
                                </div>
                                <span className="text-white font-bold shrink-0">{h.weight_percentage}%</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-400 text-xs py-4 text-center font-mono">No individual holdings extracted.</div>
                          )}
                        </div>
                      </div>

                      {/* Sector Allocation */}
                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                        <div className="text-xs text-neutral-400 font-bold uppercase font-mono mb-3 flex justify-between items-center">
                          <span>Sector Spread ({results.sector_allocation?.length || 0})</span>
                          <span className="text-[10px] text-neutral-400">Weight</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                          {results.sector_allocation && results.sector_allocation.length > 0 ? (
                            results.sector_allocation.map((s, i) => (
                              <div key={i} className="space-y-1 font-mono">
                                <div className="flex justify-between text-xs">
                                  <span className="text-neutral-300 truncate pr-2 font-sans">{s.sector_name}</span>
                                  <span className="text-white font-bold">{s.weight_percentage}%</span>
                                </div>
                                <div className="w-full bg-neutral-850 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-emerald-500 h-full rounded-full" 
                                    style={{ width: `${Math.min(100, s.weight_percentage * 2)}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-400 text-xs py-4 text-center font-mono">No sector breakdown extracted.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Performance vs Benchmark Section */}
                {(activeTab === 'all' || activeTab === 'performance') && (
                  <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider">
                        3. Performance & Benchmark Discipline
                      </h3>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        Index: {results.returns_comparison?.benchmark_name || 'Standard Benchmark'}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-neutral-800 text-neutral-400 uppercase text-[10px]">
                            <th className="py-2.5 px-3">Horizon</th>
                            <th className="py-2.5 px-3">Fund CAGR</th>
                            <th className="py-2.5 px-3">Benchmark CAGR</th>
                            <th className="py-2.5 px-3">Alpha</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                          {[
                            { period: '1 Year', data: results.returns_comparison?.one_year },
                            { period: '3 Years (Key)', data: results.returns_comparison?.three_year, highlight: true },
                            { period: '5 Years (Key)', data: results.returns_comparison?.five_year, highlight: true },
                            { period: 'Since Inception', data: results.returns_comparison?.since_inception }
                          ].map((row, i) => {
                            const fundVal = row.data?.fund_cagr;
                            const benchVal = row.data?.benchmark_cagr;
                            const alpha = calculateReturnAlpha(fundVal, benchVal);

                            return (
                              <tr key={i} className={`hover:bg-neutral-950/60 ${row.highlight ? 'bg-neutral-950/40' : ''}`}>
                                <td className="py-2.5 px-3 font-bold text-neutral-200">
                                  {row.period}
                                </td>
                                <td className="py-2.5 px-3 text-white font-bold">
                                  {fundVal !== null && fundVal !== undefined ? `${fundVal}%` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-neutral-400">
                                  {benchVal !== null && benchVal !== undefined ? `${benchVal}%` : '-'}
                                </td>
                                <td className="py-2.5 px-3">
                                  {alpha !== null ? (
                                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${alpha >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                                      {alpha >= 0 ? `+${alpha}%` : `${alpha}%`}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {alpha !== null ? (
                                    <span className={`text-[11px] ${alpha >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400'}`}>
                                      {alpha >= 0 ? 'Outperforming' : 'Lagging Index'}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 flex justify-between items-center">
                        <div>
                          <div className="text-[10px] text-neutral-400 font-mono uppercase font-bold">Turnover Ratio</div>
                          <div className="text-[11px] text-neutral-400 font-mono">Churning drag ceiling: 100%</div>
                        </div>
                        <div className={`text-base font-mono font-bold ${Number(results.risk_metrics?.portfolio_turnover_ratio_percentage) > 100 ? 'text-rose-400' : 'text-white'}`}>
                          {results.risk_metrics?.portfolio_turnover_ratio_percentage !== null && results.risk_metrics?.portfolio_turnover_ratio_percentage !== undefined ? `${results.risk_metrics.portfolio_turnover_ratio_percentage}%` : '-'}
                        </div>
                      </div>

                      <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 flex justify-between items-center">
                        <div>
                          <div className="text-[10px] text-neutral-400 font-mono uppercase font-bold">Tracking Error</div>
                          <div className="text-[11px] text-neutral-400 font-mono">Index replication error</div>
                        </div>
                        <div className="text-base font-mono font-bold text-emerald-400">
                          {results.risk_metrics?.tracking_error_percentage !== null && results.risk_metrics?.tracking_error_percentage !== undefined ? `${results.risk_metrics.tracking_error_percentage}%` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Risk & Volatility Section */}
                {(activeTab === 'all' || activeTab === 'risk_debt') && (
                  <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider">
                        4. Risk Parameters & Volatility Metrics
                      </h3>
                      <span className="text-[11px] text-neutral-400 font-mono">Sharpe, Beta & Debt Quality</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                      <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800">
                        <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Sharpe Ratio</div>
                        <div className="text-lg font-bold text-emerald-400">
                          {results.risk_metrics?.sharpe_ratio !== null && results.risk_metrics?.sharpe_ratio !== undefined ? results.risk_metrics.sharpe_ratio : '-'}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-1">Risk-adjusted return</div>
                      </div>

                      <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800">
                        <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Market Beta</div>
                        <div className={`text-lg font-bold ${Number(results.risk_metrics?.beta) > 1.05 ? 'text-amber-400' : 'text-white'}`}>
                          {results.risk_metrics?.beta !== null && results.risk_metrics?.beta !== undefined ? results.risk_metrics.beta : '-'}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-1">&gt; 1 = Higher volatility</div>
                      </div>

                      <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800">
                        <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Standard Dev.</div>
                        <div className="text-lg font-bold text-white">
                          {results.risk_metrics?.standard_deviation_percentage !== null && results.risk_metrics?.standard_deviation_percentage !== undefined ? `${results.risk_metrics.standard_deviation_percentage}%` : '-'}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-1">Annualized volatility</div>
                      </div>

                      <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800">
                        <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Yield to Maturity</div>
                        <div className="text-lg font-bold text-sky-400">
                          {results.debt_metrics?.ytm_percentage !== null && results.debt_metrics?.ytm_percentage !== undefined ? `${results.debt_metrics.ytm_percentage}%` : '-'}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-1">Debt portfolio yield</div>
                      </div>
                    </div>

                    {/* Debt & Credit Quality Breakdown */}
                    {results.debt_metrics && (results.debt_metrics.modified_duration_years_or_days || results.debt_metrics.credit_quality) && (
                      <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
                        <div className="text-xs font-mono font-bold uppercase text-neutral-400">
                          Debt & Credit Quality Allocation
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                          <div>
                            <span className="text-neutral-400 text-[10px] block">MOD. DURATION</span>
                            <span className="text-white font-bold">{results.debt_metrics.modified_duration_years_or_days || '-'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 text-[10px] block">AVG. MATURITY</span>
                            <span className="text-white font-bold">{results.debt_metrics.average_maturity_years_or_days || '-'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 text-[10px] block">SOVEREIGN / AAA</span>
                            <span className="text-emerald-400 font-bold">
                              {results.debt_metrics.credit_quality?.sovereign_percentage || results.debt_metrics.credit_quality?.aaa_percentage 
                                ? `${(Number(results.debt_metrics.credit_quality?.sovereign_percentage || 0) + Number(results.debt_metrics.credit_quality?.aaa_percentage || 0)).toFixed(1)}%` 
                                : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-400 text-[10px] block">A1+ / CASH</span>
                            <span className="text-white font-bold">
                              {results.debt_metrics.credit_quality?.a1_plus_percentage || results.debt_metrics.credit_quality?.cash_and_equivalent_percentage 
                                ? `${results.debt_metrics.credit_quality?.a1_plus_percentage || results.debt_metrics.credit_quality?.cash_and_equivalent_percentage}%` 
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. Fund Manager Section */}
                {(activeTab === 'all' || activeTab === 'managers') && (
                  <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider">
                        5. Fund Management & Track Record
                      </h3>
                      <span className="text-[11px] text-neutral-400 font-mono">Tenure Consistency</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {results.fund_managers && results.fund_managers.length > 0 ? (
                        results.fund_managers.map((m, i) => (
                          <div key={i} className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs text-neutral-300 font-mono font-bold shrink-0">
                              {m.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-white font-bold text-sm font-sans">{m.name}</div>
                              <div className="text-emerald-400 text-xs font-mono mt-0.5">{m.tenure || 'Tenure not specified'}</div>
                              {m.experience_or_role && <div className="text-neutral-400 text-[11px] font-sans mt-0.5">{m.experience_or_role}</div>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-neutral-400 text-xs py-2 font-mono">No fund manager records found.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 8. AI Executive Summary */}
                {results.notes_or_highlights && (
                  <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-xs font-sans">
                    <div className="text-neutral-400 uppercase font-bold text-[10px] font-mono mb-1.5 tracking-wider">
                      [Institutional Diagnostic Summary]
                    </div>
                    <div className="text-neutral-200 leading-relaxed">{results.notes_or_highlights}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Settings Modal */}
      <AiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={refreshAiStatus}
      />
    </div>
  );
}
