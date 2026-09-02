# Build Prompt: Personal Portfolio Allocation Tracker

Copy everything below into Cursor / AntiGravity / Lovable to kick off the build.

---

## Project Overview

Build a **local, single-user portfolio allocation tracker** web app. It runs on my laptop (no auth, no multi-user, no cloud backend required — data should persist locally, e.g. via a local JSON file, SQLite file, or browser localStorage/IndexedDB as a fallback). The core purpose:

1. Track my current holdings across a fixed set of funds/categories.
2. Compare current allocation % vs. my ideal target allocation %.
3. Every week I invest $200. Tell me exactly how to split that $200 across funds (respecting a $100 minimum investment per fund) so my portfolio moves toward the target allocation as efficiently as possible.

## Tech Stack (suggested, flexible)

- Frontend: React + Vite (or Next.js if the tool defaults to it), Tailwind for styling.
- Persistence: Local file-based storage (a `portfolio-data.json` written/read via a tiny local Node/Express backend) OR browser localStorage if no backend is available. Prioritize whichever keeps this fully local with zero external services — no Supabase/Firebase/cloud DB.
- Charts: any lightweight chart lib (recharts, chart.js) for a pie/donut chart (current allocation) and a bar chart (current % vs target % per fund).

## Data Model

### Fund/Category list (seed data, user-editable later)

| Fund | Target % |
|---|---|
| Nifty 50 | 35% |
| Mid Cap | 20% |
| Small Cap | 20% |
| Liquid Fund | 10% |
| Gold | 5% |
| Individual Stocks | 10% (this is the remainder/delta — target %s should always sum to 100%, and if I edit any target, recompute this one automatically, or flag if the total doesn't sum to 100%) |

Each fund needs:
- `name` (string)
- `targetPct` (number, editable)
- `currentValue` (number, in ₹ or $ — let me set the currency, default INR since these are Indian mutual fund categories, but keep it a config toggle)

### Portfolio state

- `totalPortfolioValue` = sum of all `currentValue`
- `currentPct` per fund = `currentValue / totalPortfolioValue * 100`
- `driftPct` per fund = `currentPct - targetPct` (negative = underweight, positive = overweight)

### History

Store a timestamped snapshot every time I update values or log a weekly investment, so I can see allocation drift over time (simple line/area chart of currentPct per fund over time is a nice-to-have, not required for v1).

## Core Features

### 1. Fund Setup / Edit Screen
- Table of all funds with editable `targetPct` and `currentValue`.
- Live validation: targets must sum to 100% (show a warning banner if not, with the current sum).
- Ability to add/remove a fund (in case I add a new category later).

### 2. Dashboard
- Donut/pie chart of current allocation.
- Bar chart: current % vs target % side-by-side per fund.
- Table with columns: Fund | Current Value | Current % | Target % | Drift (+/- pp) — color-code overweight (green/red, pick one convention) vs underweight.
- Total portfolio value displayed prominently.

### 3. Weekly Investment Allocator (the key feature)

Input: an investment amount (default **$200**, but let me override it for weeks I invest more/less) and a minimum lot size per fund (default **$100**, editable).

**Allocation algorithm** — implement exactly this, don't freelance a different heuristic:

```
function allocate(funds, investmentAmount, minLot):
    remaining = investmentAmount
    allocations = { fund: 0 for each fund }
    workingValues = { fund: fund.currentValue for each fund }  // mutable copy
    workingTotal = sum(workingValues)

    while remaining >= minLot:
        # Recompute drift in DOLLAR terms against target, using the
        # portfolio total AS IF the remaining cash were already deployed,
        # so we're targeting where the portfolio should end up, not where it is now.
        projectedTotal = workingTotal + remaining
        for each fund:
            targetValue = fund.targetPct/100 * projectedTotal
            gap[fund] = targetValue - workingValues[fund]

        pick the fund with the LARGEST positive gap
        # tie-break: if two funds are tied, pick the one with the larger targetPct

        if no fund has a positive gap (portfolio already at/above target everywhere):
            # fallback: dump remaining into the single most underweight fund
            # even if gap is negative, to avoid leaving cash unallocated
            pick fund with the largest (least negative) gap deficit, or just the
            largest targetPct fund as a tiebreak — flag this case in the UI
            ("portfolio is at target, allocating to largest fund by default")

        allocate one `minLot` chunk ($100) to that fund:
            allocations[fund] += minLot
            workingValues[fund] += minLot
            workingTotal += minLot
            remaining -= minLot

    return allocations   # e.g. { "Small Cap": 100, "Mid Cap": 100 }
```

Notes on why it's written this way:
- With $200 and a $100 minimum, this naturally splits money across **at most 2 funds per week** (or puts all $200 into one fund if it's dramatically underweight — recompute after each $100 chunk since the first chunk changes the gaps).
- If `investmentAmount` isn't a clean multiple of `minLot`, leave the leftover unallocated and show it as "carry over to next week" (store this as running state, e.g. if $200 minimum is $100 there's no leftover, but if I change minLot to $75 there would be).

Output: a clear "Invest $100 into X, $100 into Y" style result card, plus a one-line explanation of *why* (e.g. "Small Cap is 4.2pp below target, the largest gap in your portfolio").

### 4. Update Flow
After I follow the allocation and actually invest, give me a one-click "Apply this allocation" button that updates each fund's `currentValue` by the allocated amount and saves a new snapshot to history.

## Non-functional requirements
- Everything runs locally — `npm run dev` (or equivalent) should be enough to use it day-to-day. No signup, no external API calls except optionally live fund NAV lookups (skip this for v1 — all values are entered manually).
- Data must persist across restarts (local file or localStorage — pick one and make it robust, with an export/import JSON button as a manual backup option).
- Simple, clean, dashboard-style UI — this is a personal tool I'll open weekly, not a polished product, so prioritize function and clarity over polish. Numbers should be easy to scan at a glance.

## Nice-to-haves (only if trivial, skip if they add complexity)
- Toggle currency symbol (₹ / $).
- Allocation drift chart over time.
- Dark mode.
