/**
 * Exact greedy allocation algorithm from the spec.
 *
 * @param {Array}  funds            - [{ id, name, targetPct, currentValue }]
 * @param {number} investmentAmount - total to allocate (e.g. 200)
 * @param {number} minLot           - minimum chunk size (e.g. 100)
 * @returns {{ allocations, carryOver, fallbackUsed, reasons }}
 */
export function allocate(funds, investmentAmount, minLot) {
  let remaining = investmentAmount
  const allocations = {}
  const workingValues = {}

  funds.forEach(f => {
    allocations[f.id] = 0
    workingValues[f.id] = f.currentValue
  })

  let workingTotal = funds.reduce((s, f) => s + f.currentValue, 0)
  let fallbackUsed = false
  const reasons = []      // [{ fundId, gap, fallback }] — one per chunk

  while (remaining >= minLot) {
    // Recompute gaps as-if remaining cash is already deployed
    const projectedTotal = workingTotal + remaining
    const gaps = {}

    funds.forEach(f => {
      const targetValue = (f.targetPct / 100) * projectedTotal
      gaps[f.id] = targetValue - workingValues[f.id]
    })

    // Find fund with largest positive gap
    let bestId = null
    let bestGap = -Infinity

    funds.forEach(f => {
      const g = gaps[f.id]
      if (g > bestGap) {
        bestGap = g
        bestId = f.id
      } else if (g === bestGap && bestId !== null) {
        // Tiebreak: larger targetPct wins
        const challenger = funds.find(x => x.id === f.id)
        const current    = funds.find(x => x.id === bestId)
        if (challenger.targetPct > current.targetPct) {
          bestId = f.id
        }
      }
    })

    // Fallback: all gaps ≤ 0 — pick fund with least-negative (largest) gap
    if (bestGap <= 0) {
      fallbackUsed = true
      bestId = funds.reduce((acc, f) => {
        const g = gaps[f.id]
        const bestG = gaps[acc]
        if (g > bestG) return f.id
        if (g === bestG) {
          const fFund   = funds.find(x => x.id === f.id)
          const accFund = funds.find(x => x.id === acc)
          return fFund.targetPct > accFund.targetPct ? f.id : acc
        }
        return acc
      }, funds[0].id)
    }

    // Allocate one minLot chunk to bestId
    allocations[bestId]      += minLot
    workingValues[bestId]    += minLot
    workingTotal             += minLot
    remaining                -= minLot

    reasons.push({
      fundId:   bestId,
      gap:      gaps[bestId],
      fallback: fallbackUsed && reasons.length === 0,  // only flag first fallback chunk
    })
  }

  return {
    allocations,
    carryOver:    remaining,
    fallbackUsed,
    reasons,
  }
}
