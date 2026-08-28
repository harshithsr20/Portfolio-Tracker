/**
 * Compute derived portfolio metrics from a funds array.
 */

export function computeTotalValue(funds) {
  return funds.reduce((sum, f) => sum + (Number(f.currentValue) || 0), 0)
}

export function computeCurrentPct(fund, totalValue) {
  if (!totalValue || totalValue === 0) return 0
  return (Number(fund.currentValue) / totalValue) * 100
}

export function computeDrift(fund, totalValue) {
  return computeCurrentPct(fund, totalValue) - Number(fund.targetPct)
}

export function computeTargetSum(funds) {
  return funds.reduce((s, f) => s + (Number(f.targetPct) || 0), 0)
}

/**
 * Specific Color Mapping requested by user:
 * - Nifty: Dark Red (#8B0000 / #991B1B)
 * - Mid cap: Green (#16A34A)
 * - Small cap: Blue (#2563EB)
 * - Liquid: Teal (#0D9488)
 * - Gold: Golden color (#EAB308 / #F59E0B)
 * - US Tech: Light red (#F87171)
 * - China: Yellow (#FACC15)
 * - Individual stocks: Black (#1C1C1C / #262626)
 */
export function getFundColor(fundNameOrId, index = 0) {
  const name = String(fundNameOrId || '').toLowerCase()

  if (name.includes('nifty')) return '#991B1B'        // Dark Red
  if (name.includes('mid')) return '#16A34A'          // Green
  if (name.includes('small')) return '#2563EB'        // Blue
  if (name.includes('liquid')) return '#0D9488'       // Teal
  if (name.includes('gold')) return '#F59E0B'         // Golden
  if (name.includes('us tech') || name.includes('tech') || name.includes('ustech')) return '#F87171' // Light Red
  if (name.includes('china')) return '#FACC15'        // Yellow
  if (name.includes('stock') || name.includes('individual')) return '#2A2A2A' // Black / Dark Slate

  const fallbackPalette = [
    '#991B1B', '#16A34A', '#2563EB', '#0D9488',
    '#F59E0B', '#F87171', '#FACC15', '#2A2A2A',
    '#A855F7', '#EC4899', '#06B6D4'
  ]
  return fallbackPalette[index % fallbackPalette.length]
}

/**
 * Enrich funds with currentPct, driftPct, and assigned color.
 */
export function enrichFunds(funds) {
  const total = computeTotalValue(funds)
  return funds.map((f, i) => ({
    ...f,
    currentValue: Number(f.currentValue) || 0,
    targetPct: Number(f.targetPct) || 0,
    currentPct: computeCurrentPct(f, total),
    driftPct:   computeDrift(f, total),
    totalValue: total,
    color: f.color || getFundColor(f.name || f.id, i),
  }))
}

/**
 * Format a number as Indian Rupee (INR) currency string.
 * @param {number} value
 * @param {string} currency - defaults to INR
 * @param {boolean} compact
 */
export function formatCurrency(value, currency = 'INR', compact = false) {
  const symbol = '₹'
  const val = Number(value) || 0

  if (compact && Math.abs(val) >= 10000000) {
    return `${symbol}${(val / 10000000).toFixed(2)} Cr`
  }
  if (compact && Math.abs(val) >= 100000) {
    return `${symbol}${(val / 100000).toFixed(2)} L`
  }
  if (compact && Math.abs(val) >= 1000) {
    return `${symbol}${(val / 1000).toFixed(1)} K`
  }
  return `${symbol}${val.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export function formatPct(value, decimals = 1) {
  const val = Number(value) || 0
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(decimals)}%`
}
