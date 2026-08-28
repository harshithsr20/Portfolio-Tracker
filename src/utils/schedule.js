/**
 * Weekly Investment Schedule and Rebalancing Engine
 * 
 * Investment Cycle:
 * - Sunday (Day 0): Automated Portfolio Audit & Next Saturday Strategy Generation
 * - Monday - Friday (Days 1 - 5): Mid-week Preparation & Capital Readiness
 * - Saturday (Day 6): Investment Execution Day
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(date) {
  const d = new Date(date)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDayDate(date) {
  const d = new Date(date)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function getWeeklyScheduleInfo(currentDate = new Date()) {
  const now = new Date(currentDate)
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayName = DAYS[dayOfWeek]

  // Calculate the Sunday that started/starts this weekly cycle
  // If today is Sunday (0), it's today. If Mon-Sat, subtract dayOfWeek days.
  const currentSunday = new Date(now)
  currentSunday.setDate(now.getDate() - dayOfWeek)
  currentSunday.setHours(0, 0, 0, 0)

  // Calculate the Target Saturday for this cycle (Sunday + 6 days)
  const targetSaturday = new Date(currentSunday)
  targetSaturday.setDate(currentSunday.getDate() + 6)
  targetSaturday.setHours(23, 59, 59, 999)

  // Days remaining until target Saturday
  const daysUntilSaturday = 6 - dayOfWeek

  // Unique key for this week's cycle (e.g. "cycle_2026-08-23")
  const cycleKey = `cycle_${currentSunday.toISOString().slice(0, 10)}`

  const isSunday = dayOfWeek === 0
  const isSaturday = dayOfWeek === 6
  const isMidWeek = dayOfWeek >= 1 && dayOfWeek <= 5

  let stage = 'MIDWEEK_PREP'
  let stageTitle = 'Weekly Accumulation Phase'
  let stageDesc = `Portfolio strategy locked in on Sunday. Next execution in ${daysUntilSaturday} day${daysUntilSaturday === 1 ? '' : 's'} (Saturday).`

  if (isSunday) {
    stage = 'SUNDAY_AUDIT'
    stageTitle = 'Sunday Strategy Generation Active'
    stageDesc = `Today is Sunday! Your portfolio allocation has been audited to generate this coming Saturday's investment plan.`
  } else if (isSaturday) {
    stage = 'SATURDAY_EXECUTION'
    stageTitle = 'Investment Execution Day'
    stageDesc = `Today is Saturday! Execute your weekly investment allocation below.`
  }

  return {
    now,
    dayOfWeek,
    dayName,
    isSunday,
    isSaturday,
    isMidWeek,
    currentSunday,
    targetSaturday,
    daysUntilSaturday,
    cycleKey,
    stage,
    stageTitle,
    stageDesc,
    sundayDateFormatted: formatDayDate(currentSunday),
    saturdayDateFormatted: formatDayDate(targetSaturday),
  }
}
