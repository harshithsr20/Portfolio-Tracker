import { useState, useEffect } from 'react'
import {
  getStoredProvider,
  setStoredProvider,
  getStoredApiKey,
  setStoredApiKey,
  removeStoredApiKey,
} from '../utils/aiVision'

export default function AiSettingsModal({ isOpen, onClose, onSave }) {
  const [provider, setProvider] = useState('gemini')
  const [geminiKey, setGeminiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const curProvider = getStoredProvider()
      setProvider(curProvider)
      setGeminiKey(getStoredApiKey('gemini'))
      setGroqKey(getStoredApiKey('groq'))
      setSavedSuccess(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    setStoredProvider(provider)
    if (provider === 'gemini') {
      setStoredApiKey('gemini', geminiKey)
    } else {
      setStoredApiKey('groq', groqKey)
    }
    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      if (onSave) onSave()
      onClose()
    }, 600)
  }

  const handleClear = () => {
    removeStoredApiKey(provider)
    if (provider === 'gemini') setGeminiKey('')
    else setGroqKey('')
  }

  const currentKey = provider === 'gemini' ? geminiKey : groqKey
  const hasKey = Boolean(currentKey.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono text-sm font-bold">
              AI
            </div>
            <div>
              <h3 className="text-white font-bold text-base font-display">AI Vision Settings</h3>
              <p className="text-xs text-neutral-400 font-mono">Run Fact Sheet Analyzer directly in browser on GitHub Pages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Vision AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  provider === 'gemini'
                    ? 'bg-neutral-800 border-emerald-500 text-white shadow-md shadow-emerald-950/30'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-white">Google Gemini</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    FREE
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono leading-tight">
                  Gemini 1.5/2.0 Flash with high vision accuracy and free quota
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('groq')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  provider === 'groq'
                    ? 'bg-neutral-800 border-emerald-500 text-white shadow-md shadow-emerald-950/30'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-white">Groq Vision</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                    FAST
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono leading-tight">
                  Llama 3.2 11B Vision for ultra-fast multi-page inference
                </p>
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">
                {provider === 'gemini' ? 'Gemini API Key' : 'Groq API Key'}
              </label>
              <a
                href={
                  provider === 'gemini'
                    ? 'https://aistudio.google.com/app/apikey'
                    : 'https://console.groq.com/keys'
                }
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
              >
                <span>Get Free Key</span>
                <span className="text-xs">↗</span>
              </a>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={provider === 'gemini' ? geminiKey : groqKey}
                onChange={(e) => {
                  if (provider === 'gemini') setGeminiKey(e.target.value)
                  else setGroqKey(e.target.value)
                }}
                placeholder={
                  provider === 'gemini'
                    ? 'AIzaSy...'
                    : 'gsk_...'
                }
                className="ather-input font-mono text-xs pr-20 py-2.5"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800"
              >
                {showKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>

            <p className="text-[11px] text-neutral-400 font-mono mt-2">
              🔒 Key is saved locally in your browser's <code className="text-neutral-300">localStorage</code>. It is never transmitted anywhere except directly to Google / Groq.
            </p>
          </div>

          {/* Status info box */}
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Current Status:</span>
              <span className={hasKey ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {hasKey ? '✓ Ready for Client-Side Vision' : '⚠️ Key Required for Analysis'}
              </span>
            </div>
            <div className="text-[11px] text-neutral-500">
              Works 100% on GitHub Pages with zero server backend needed.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-mono text-neutral-400 hover:text-rose-400 px-3 py-2 rounded-lg hover:bg-neutral-900 transition-colors"
          >
            Clear Key
          </button>
          
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="ather-btn-secondary py-2 px-4 text-xs font-mono"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="ather-btn-primary py-2 px-5 text-xs font-mono"
            >
              {savedSuccess ? '✓ SAVED!' : 'SAVE & APPLY'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
