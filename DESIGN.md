# AFA DISPATCH — Design System

## Palette

- **Surface**: #f8f7f4 — warm off-white page background
- **Card**: #ffffff — card/section surface
- **Card hover**: #faf9f6 — hover state
- **Border**: #e8e6e1 — subtle warm separation
- **Border accent**: #f59e0b (amber-500) — interactive emphasis
- **Text primary**: #1a1917 — headings, body
- **Text secondary**: #6b6960 — labels, muted text
- **Text tertiary**: #9a9589 — captions, hints
- **Accent**: #f59e0b (amber-500) — interactive, emphasis
- **Accent hover**: #d97706 (amber-600)
- **Danger**: #ef4444 (red-500) — destructive actions
- **Success**: #10b981 (emerald-500) — completed/paid states
- **Info**: #3b82f6 (blue-500) — informational states

## Typography

- **Font**: Geist Sans (body), Geist Mono (data/numbers)
- **Base size**: 14px (body), 16px (important), 12px (small)
- **Scale**: 10px (captions) → 12px (labels) → 14px (body) → 16px (emphasis) → 20px (titles) → 24px (KPI)
- **Line height**: 1.6 (body), 1.4 (headings)
- **Tracking**: -0.01em headings, 0.05em labels

## Spacing

- Generous padding: p-6 for sections, p-5 for cards
- Card gap: gap-4
- Table cells: px-4 py-3.5
- Clean, breathing room everywhere

## Components

### Card
- bg-white, border-[#e8e6e1], rounded-xl, shadow-sm
- Hover: border-[#d4d2cd], subtle shadow increase
- No harsh contrasts

### Button - Primary
- bg-amber-500, text-[#1a1917], font-semibold, rounded-lg
- Hover: bg-amber-400
- Active: scale(0.98)

### Button - Secondary
- border-[#e8e6e1], bg-white, text-[#4a4740]
- Hover: bg-[#f3f2ee]

### Input
- bg-white, border-[#e8e6e1], text-[#1a1917]
- Focus: border-amber-400, ring-2 ring-amber-100
- Placeholder: #b0ab9f

### Badge
- Rounded-full, small text, tinted backgrounds
- Amber for active, Green for success, Red for danger, Blue for info

### Table
- Clean white background
- Warm gray header row
- Subtle row borders
- Hover: light warm tint

## Motion

- **Reveal**: fade-slide-up 400ms ease-out (staggered: 60ms per item)
- **Press**: transform scale(0.98) on active
- **Hover**: subtle border/bg shift, no heavy effects

## Anti-patterns

- NO dark themes — use warm light backgrounds
- NO harsh contrast — use warm grays
- NO tiny text — minimum 12px
- NO busy layouts — generous whitespace
- NO emoji — use clean text/icons
