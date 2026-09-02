/**
 * Client-side Vision AI Fact Sheet Analyzer
 * Supports Google Gemini (Free / Direct) and Groq Vision APIs directly from the browser
 * Works 100% on GitHub Pages without requiring a backend server.
 */

const STORAGE_KEY_GEMINI = 'portfolio_tracker_gemini_api_key'
const STORAGE_KEY_GROQ = 'portfolio_tracker_groq_api_key'
const STORAGE_KEY_PROVIDER = 'portfolio_tracker_ai_provider'

export function getStoredProvider() {
  return localStorage.getItem(STORAGE_KEY_PROVIDER) || 'gemini'
}

export function setStoredProvider(provider) {
  localStorage.setItem(STORAGE_KEY_PROVIDER, provider)
}

export function getStoredApiKey(provider = getStoredProvider()) {
  if (provider === 'gemini') {
    return localStorage.getItem(STORAGE_KEY_GEMINI) || import.meta.env.VITE_GEMINI_API_KEY || ''
  }
  return localStorage.getItem(STORAGE_KEY_GROQ) || import.meta.env.VITE_GROQ_API_KEY || ''
}

export function setStoredApiKey(provider, key) {
  if (provider === 'gemini') {
    localStorage.setItem(STORAGE_KEY_GEMINI, key.trim())
  } else {
    localStorage.setItem(STORAGE_KEY_GROQ, key.trim())
  }
}

export function removeStoredApiKey(provider) {
  if (provider === 'gemini') {
    localStorage.removeItem(STORAGE_KEY_GEMINI)
  } else {
    localStorage.removeItem(STORAGE_KEY_GROQ)
  }
}

/**
 * Optimizes an image File using HTML5 Canvas:
 * Resizes max dimension to ~1000px and compresses to JPEG 0.8 to fit within LLM token limits.
 */
export async function optimizeImageForVision(file, maxDim = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64Raw = dataUrl.split(',')[1]

        resolve({
          dataUrl,
          base64Raw,
          mimeType: 'image/jpeg',
          width,
          height,
        })
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Strips markdown fences, quotes, or conversational preamble to parse raw JSON.
 */
export function cleanJsonString(str) {
  if (!str) return '{}'
  let cleaned = str.trim()
  // Remove markdown json block markers
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (match) {
    cleaned = match[1].trim()
  } else {
    // If no explicit code block, find first '{' and last '}'
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1)
    }
  }
  return cleaned
}

/**
 * Deterministically computes institutional financial health flags from parsed data.
 */
export function computeDiagnosticFlags(data) {
  const flags = Array.isArray(data?.diagnostic_flags) ? [...data.diagnostic_flags] : []
  const existingTitles = new Set(flags.map(f => f?.title).filter(Boolean))

  // 1. Direct Expense Ratio (TER)
  const terDirect = data?.ter_direct_percentage
  if (terDirect !== undefined && terDirect !== null && !existingTitles.has('Direct TER Assessment')) {
    if (terDirect < 0.5) {
      flags.push({
        category: 'cost_and_size',
        title: 'Direct TER Assessment',
        status: 'good',
        message: `Low Direct TER (${terDirect}%) protects long-term compounding returns.`,
      })
    } else if (terDirect > 1.2) {
      flags.push({
        category: 'cost_and_size',
        title: 'Direct TER Assessment',
        status: 'warning',
        message: `Elevated Direct TER (${terDirect}%) exceeds typical cost efficiency.`,
      })
    } else {
      flags.push({
        category: 'cost_and_size',
        title: 'Direct TER Assessment',
        status: 'good',
        message: `Standard Direct TER (${terDirect}%) within healthy category bounds.`,
      })
    }
  }

  // 2. Cash Level Drag
  const cash = data?.cash_level_percentage
  if (cash !== undefined && cash !== null && !existingTitles.has('Cash Level Assessment')) {
    if (cash > 10.0) {
      flags.push({
        category: 'portfolio_quality',
        title: 'Cash Level Assessment',
        status: 'danger',
        message: `High cash level (${cash}%) signals defensive stance and potential idle cash return drag.`,
      })
    } else if (cash > 7.0) {
      flags.push({
        category: 'portfolio_quality',
        title: 'Cash Level Assessment',
        status: 'warning',
        message: `Moderate cash allocation (${cash}%) indicates tactical cash buffering.`,
      })
    } else {
      flags.push({
        category: 'portfolio_quality',
        title: 'Cash Level Assessment',
        status: 'good',
        message: `Lean cash holding (${cash}%) keeps capital fully deployed.`,
      })
    }
  }

  // 3. Top 10 Concentration
  let top10 = data?.top_10_concentration_percentage
  if ((top10 === undefined || top10 === null) && Array.isArray(data?.top_holdings) && data.top_holdings.length > 0) {
    top10 = Number(data.top_holdings.slice(0, 10).reduce((s, h) => s + (Number(h?.weight_percentage) || 0), 0).toFixed(2))
    data.top_10_concentration_percentage = top10
  }

  if (top10 !== undefined && top10 !== null && !existingTitles.has('Top 10 Concentration')) {
    if (top10 > 50.0) {
      flags.push({
        category: 'portfolio_quality',
        title: 'Top 10 Concentration',
        status: 'warning',
        message: `High concentration (${top10}% in top 10) elevates single-stock exposure risk.`,
      })
    } else {
      flags.push({
        category: 'portfolio_quality',
        title: 'Top 10 Concentration',
        status: 'good',
        message: `Healthy diversification (${top10}% in top 10) mitigates stock-specific drawdowns.`,
      })
    }
  }

  // 4. Portfolio Turnover
  const turnover = data?.risk_metrics?.portfolio_turnover_ratio_percentage
  if (turnover !== undefined && turnover !== null && !existingTitles.has('Portfolio Turnover')) {
    if (turnover > 100.0) {
      flags.push({
        category: 'risk',
        title: 'Portfolio Turnover',
        status: 'warning',
        message: `High turnover (${turnover}%) signals frequent churning and elevated trading friction costs.`,
      })
    } else {
      flags.push({
        category: 'risk',
        title: 'Portfolio Turnover',
        status: 'good',
        message: `Disciplined turnover (${turnover}%) reflects patient buy-and-hold conviction.`,
      })
    }
  }

  // 5. Beta Volatility
  const beta = data?.risk_metrics?.beta
  if (beta !== undefined && beta !== null && !existingTitles.has('Market Beta')) {
    if (beta > 1.1) {
      flags.push({
        category: 'risk',
        title: 'Market Beta',
        status: 'warning',
        message: `Beta of ${beta} indicates higher volatility and amplification during market swings.`,
      })
    } else if (beta < 0.9) {
      flags.push({
        category: 'risk',
        title: 'Market Beta',
        status: 'info',
        message: `Beta of ${beta} offers defensive cushion against broader market declines.`,
      })
    }
  }

  // 6. 3-Year Benchmark Comparison
  const ret = data?.returns_comparison
  const threeYr = ret?.three_year
  const f3y = threeYr?.fund_cagr
  const b3y = threeYr?.benchmark_cagr
  if (f3y !== undefined && f3y !== null && b3y !== undefined && b3y !== null && !existingTitles.has('3-Year Benchmark Comparison')) {
    const diff = Number((f3y - b3y).toFixed(2))
    if (diff >= 0) {
      flags.push({
        category: 'performance',
        title: '3-Year Benchmark Comparison',
        status: 'good',
        message: `Outperformed benchmark by +${diff}% CAGR over 3 years (Fund: ${f3y}% vs Index: ${b3y}%).`,
      })
    } else {
      flags.push({
        category: 'performance',
        title: '3-Year Benchmark Comparison',
        status: 'warning',
        message: `Lagged benchmark by ${diff}% CAGR over 3 years (Fund: ${f3y}% vs Index: ${b3y}%).`,
      })
    }
  }

  return flags
}

const SYSTEM_PROMPT_TEMPLATE = (targetFund) => `
You are an institutional mutual fund analyst and quantitative researcher.
Analyze the provided screenshots of a multi-page mutual fund fact sheet.
Extract comprehensive data across all pages into a consolidated JSON object.
Target portfolio fund: ${targetFund || 'Auto-Detect'}.

Strictly extract and evaluate all of the following parameters:
1. Cost & Size:
   - Direct TER (%) and Regular TER (%)
   - AUM (₹ in Crores)
   - Cost & size verdict (evaluate agility vs overhead)
2. Portfolio Quality:
   - Cash / TREPS / Liquid / Net Current Assets level (%)
   - Top 10 Holdings total concentration (%)
   - Top holdings list (company name, weight %, sector)
   - Sector allocation breakdown (sector name, weight %)
3. Performance & Discipline:
   - Benchmark Name (e.g. Nifty 50 TRI, Nifty Midcap 150 TRI, etc.)
   - CAGR Returns (1-Year, 3-Year, 5-Year, Since Inception) for both Fund and Benchmark
   - Portfolio Turnover Ratio (%)
   - Tracking Error (%) [if index fund]
4. Risk Metrics:
   - Sharpe Ratio
   - Beta (volatility against benchmark)
   - Standard Deviation (%)
5. Debt / Liquid Fund Metrics (if applicable):
   - YTM (%)
   - Modified Duration & Average Maturity / Macaulay Duration
   - Credit Quality Breakdown (Sovereign %, AAA %, AA %, A1+ %, Cash %)
6. Fund Management:
   - Fund Manager name(s), tenure managing this fund, and roles
7. Key diagnostic insights and highlights

Strictly return ONLY valid JSON matching this exact schema:
{
  "detected_fund_name": "Full name found in factsheet",
  "matched_portfolio_fund": "One of: HDFC Nifty 50 | Nippon India Growth | Edelweiss Small Cap | Axis Liquid | Other",
  "as_of_date": "YYYY-MM-DD or Month Year",
  "aum_in_crores": 0.0,
  "ter_direct_percentage": 0.0,
  "ter_regular_percentage": 0.0,
  "cost_and_size_verdict": "1-2 sentences on cost efficiency & AUM agility",
  "cash_level_percentage": 0.0,
  "top_10_concentration_percentage": 0.0,
  "top_holdings": [
    { "company_name": "string", "weight_percentage": 0.0, "sector": "string" }
  ],
  "sector_allocation": [
    { "sector_name": "string", "weight_percentage": 0.0 }
  ],
  "returns_comparison": {
    "benchmark_name": "string",
    "one_year": { "fund_cagr": null, "benchmark_cagr": null },
    "three_year": { "fund_cagr": null, "benchmark_cagr": null },
    "five_year": { "fund_cagr": null, "benchmark_cagr": null },
    "since_inception": { "fund_cagr": null, "benchmark_cagr": null }
  },
  "risk_metrics": {
    "sharpe_ratio": null,
    "beta": null,
    "standard_deviation_percentage": null,
    "portfolio_turnover_ratio_percentage": null,
    "tracking_error_percentage": null
  },
  "debt_metrics": {
    "ytm_percentage": null,
    "modified_duration_years_or_days": null,
    "average_maturity_years_or_days": null,
    "macaulay_duration_years_or_days": null,
    "credit_quality": {
      "sovereign_percentage": null,
      "aaa_percentage": null,
      "aa_percentage": null,
      "a1_plus_percentage": null,
      "cash_and_equivalent_percentage": null
    }
  },
  "fund_managers": [
    { "name": "Manager Name", "tenure": "e.g. 5 Years (Since Aug 2019)", "experience_or_role": "string" }
  ],
  "diagnostic_flags": [
    { "category": "cost_and_size|portfolio_quality|performance|risk|fund_manager", "title": "string", "status": "good|warning|danger|info", "message": "string" }
  ],
  "investor_verdict": {
    "action": "SUITABLE_FOR_ALLOCATION | HOLD_AND_MONITOR | REVIEW_CAUTION",
    "thesis": "Concise 1-2 sentence core investment verdict based on factsheet metrics",
    "key_strengths": ["Clear advantage 1", "Clear advantage 2", "Clear advantage 3"],
    "key_risks_to_watch": ["Key risk or watchpoint 1", "Key risk or watchpoint 2"],
    "investor_takeaway": "Actionable takeaway for portfolio compounding"
  },
  "notes_or_highlights": "Concise key takeaway on portfolio health, benchmark discipline, and manager consistency."
}
`

/**
 * Main function to execute multi-page fact sheet vision analysis.
 * Automatically tries client-side Gemini / Groq or backend proxy.
 */
export async function analyzeFactSheetWithVision({
  files,
  targetFund = 'auto',
  provider = getStoredProvider(),
  apiKey = getStoredApiKey(provider),
}) {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one fact sheet page image.')
  }

  // 1. Optimize images in browser canvas
  const optimizedImages = await Promise.all(
    files.map(file => optimizeImageForVision(file, 1000, 0.8))
  )

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE(targetFund)

  // 2. Client-side execution with Gemini API
  if (provider === 'gemini' && apiKey) {
    try {
      // Try Gemini 1.5 Flash (or Gemini 2.0 Flash)
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`
      
      const parts = [
        { text: systemPrompt },
        ...optimizedImages.map(img => ({
          inline_data: {
            mime_type: img.mimeType,
            data: img.base64Raw,
          }
        }))
      ]

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData?.error?.message || `Gemini API returned status ${response.status}`
        throw new Error(errorMsg)
      }

      const resJson = await response.json()
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) {
        throw new Error('Gemini did not return any text response.')
      }

      const cleaned = cleanJsonString(rawText)
      const parsed = JSON.parse(cleaned)
      parsed.diagnostic_flags = computeDiagnosticFlags(parsed)
      return parsed
    } catch (err) {
      console.error('Gemini Vision Client Error:', err)
      throw new Error(`Gemini Analysis Error: ${err.message}`)
    }
  }

  // 3. Client-side execution with Groq API
  if (provider === 'groq' && apiKey) {
    try {
      const endpoint = 'https://api.groq.com/openai/v1/chat/completions'
      
      const content = [
        { type: 'text', text: systemPrompt },
        ...optimizedImages.map(img => ({
          type: 'image_url',
          image_url: { url: img.dataUrl },
        }))
      ]

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages: [{ role: 'user', content }],
          temperature: 0.1,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData?.error?.message || `Groq API returned status ${response.status}`
        throw new Error(errorMsg)
      }

      const resJson = await response.json()
      const rawText = resJson?.choices?.[0]?.message?.content
      if (!rawText) {
        throw new Error('Groq did not return any text response.')
      }

      const cleaned = cleanJsonString(rawText)
      const parsed = JSON.parse(cleaned)
      parsed.diagnostic_flags = computeDiagnosticFlags(parsed)
      return parsed
    } catch (err) {
      console.error('Groq Vision Client Error:', err)
      throw new Error(`Groq Analysis Error: ${err.message}`)
    }
  }

  // 4. Fallback: Try local/backend proxy if configured
  try {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('target_fund', targetFund)

    const res = await fetch('/api/factsheets/analyze-multiple', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const data = await res.json()
      data.diagnostic_flags = computeDiagnosticFlags(data)
      return data
    }
  } catch {
    // Backend proxy not available (expected on GitHub Pages)
  }

  // 5. No key provided
  throw new Error('NO_API_KEY_CONFIGURED')
}
