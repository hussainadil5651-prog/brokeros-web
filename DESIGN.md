# AFA DISPATCH — Design System

## Palette

- **Surface**: #09090b (zinc-950) — absolute darkest, page background
- **Card**: #18181b (zinc-900) — card/section surface at 50% opacity on bg
- **Card hover**: #27272a (zinc-800) — hover state for cards/rows
- **Border**: rgba(255,255,255,0.06) — subtle separation
- **Border accent**: rgba(245,158,11,0.30) — amber callout borders
- **Text primary**: #e4e4e7 (zinc-200) — headings, body
- **Text secondary**: #a1a1aa (zinc-400) — labels, muted text
- **Text tertiary**: #52525b (zinc-600) — captions, hints
- **Accent**: #f59e0b (amber-500) — interactive, emphasis
- **Accent glow**: rgba(245,158,11,0.10) bg — hover/active fills
- **Danger**: #f43f5e (rose-500) — destructive actions
- **Success**: #34d399 (emerald-400) — completed/paid states

## Typography

- **Font**: Geist Sans (body), Geist Mono (data/numbers)
- **Scale**: 9px (captions) → 10px (meta) → 11px (small) → 12px (body) → 14px (body large) → 16px (cards) → 20px (page title)
- **Tracking**: 0.15em uppercase labels, 0.1em uppercase headers, -0.02em headings
- **Feature settings**: "cv02", "cv03", "cv04", "cv11" — Geist OpenType features

## Spacing

- Scale: 1 → 1.5 → 2 → 3 → 4 → 6 → 8 (multiples of 4/6)
- Section padding: px-6 py-4 header, p-6 content
- Card padding: p-4 (16px)
- Tight spacing: 1.5 (6px) for compact lists
- Table cells: px-4 py-3

## Components

### Card
- bg-zinc-900/50, border-white/[0.06], rounded-lg
- Hover: border-amber-500/20
- Active: press scale(0.98)

### Button - Primary
- bg-amber-500, text-zinc-950, font-semibold
- Hover: bg-amber-400
- Active: press scale(0.98)

### Button - Ghost
- border-white/[0.06], text-zinc-500
- Hover: bg-zinc-800, text-zinc-300
- Active: press scale(0.97)
- No box-shadow

### Input
- bg-zinc-950, border-white/[0.06], text-zinc-100
- Focus: border-amber-500/30
- Placeholder: zinc-700
- No ring, no shadow

### Status Badge
- 3-tier system: waiting (zinc), active (amber variants), done (emerald)
- border + bg tint per status level, not per individual status

### Table
- Header: text-[10px] uppercase tracking-wider, border-b
- Row: border-b border-white/[0.04], hover:bg-white/[0.02]
- Monospace for numbers

## Motion

- **Reveal**: fade-slide-up 500ms ease-out (staggered delays: 80ms per item)
- **Press**: transform scale(0.97) on active, 100ms ease
- **Hover**: subtle bg tint or border accent, no translateY
- **Pulse-dot**: 2s ease-in-out for live indicators
- **Spinner**: 8px border-2 amber, border-t-transparent

## Anti-patterns

- NO box-shadow — use border + bg contrast
- NO ring — use border
- NO emoji in UI — use text icons (◈ ● ◆ ⬡)
- NO more than 3 text gray levels (primary/secondary/tertiary)
- NO translateY hover — Hallmark says kinetic text is fine, lift is not
- NO scrollbar-width inline — use scrollbar-thin utility class
- NO color proliferation — 1 accent (amber), 1 danger (rose), 1 success (emerald)

## Grain

Fixed SVG noise overlay at opacity 0.03, z-index 9999, pointer-events none.

## Overlay (Modals)

Fixed inset-0, bg-zinc-950/80 (no black), backdrop-blur-sm.

## Scrollbar

```
.scrollbar-thin { scrollbar-width: thin; }
```
