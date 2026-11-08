# Daywise — Design System v1 (binding)

Source of truth: `docs/design/Daywise_admin.pdf` (19 pages) and the per-screen PNGs in `docs/design/screens/`. Open the PNG for the screen you are building before you write JSX. Where this file and the PNG disagree, this file wins (it records agreed deviations).

Principle: hierarchy comes from Inter's size and weight, not colour. Surfaces are flat and separated by hairlines. Indigo is spent once per screen. Photography carries the warmth.

## Tokens (Tailwind v4 `@theme` names in parentheses)

### Colour
| Token | Hex | Use |
|---|---|---|
| surface (`--color-surface`) | #F7F5F1 | Page background |
| surface-raised | #FCFBF9 | Inputs, right panel, sheets, menus |
| surface-sunken | #EFECE6 | Table header, hovered rows, hotel card body |
| line | #E2DED6 | Hairline rules, photo outlines |
| line-strong | #908B82 | Input and secondary button borders |
| ink | #1C1B19 | Primary text and icons |
| ink-secondary | #5E5B55 | Secondary text, labels, column headers |
| ink-muted | #6F6B64 | Metadata, timestamps, placeholders |
| indigo | #2E3A8C | Primary action, focus, active tab, links |
| indigo-hover | #273179 | Hover / pressed |
| indigo-soft | #E7E9F4 | Assumed brief fields, drop slot |
| on-indigo | #F7F5F1 | Text on indigo |
| green | #2F6342 | Confirmed, Verified, Saved |
| green-soft | #E2EBE3 | Verified badge ground |
| amber | #8A5A12 | Sent, Verify before sending, unsaved |
| amber-soft | #F3E8D2 | Verify badge ground |
| danger | #9A3A2C | Destructive confirmations and errors |
| photo-sand / sage / slate / clay | #D9D2C5 / #C9D1CA / #CDD1D8 / #D7CEC7 | Photo slot grounds, rotated by index |
| scrim | #1C1B19 @ 20% | Behind sheets and dialogs |

No pure black, no pure white. No second accent. Colour is never the only signal: every status has a word.

### Type (Inter only; weights 400/500/600, never 700, no italics)
| Token | Size/line · weight · tracking | Use |
|---|---|---|
| display-1 | 40/44 · 600 · -0.022em | Sign-in, empty state |
| display-2 | 32/36 · 600 · -0.02em | Page titles, itinerary title |
| heading-1 | 24/30 · 600 · -0.015em | Day titles |
| heading-2 | 18/24 · 600 · -0.01em | Hotel names, panel titles |
| heading-3 | 15/20 · 600 | Stop titles, table first column |
| body | 15/24 · 400 | Descriptions |
| body-sm | 13/20 · 400 | Table cells, metadata lines |
| caption | 12/16 · 400 | Timestamps, hints |
| label | 11/16 · 500 · +0.06em · uppercase | Field labels, column headers, eyebrows |
| numeric | 15/24 · 500 · tabular-nums | Prices, counts |

### Spacing (4px base; gaps via flex/grid gap, never sibling margins)
space-1 4 · space-2 8 · space-3 12 · space-4 16 · space-5 24 · space-6 32 · space-7 48 · space-8 64 · space-9 96

### Borders, radius, depth
- Every border 1px. `line` for decorative rules; `line-strong` only where the border carries meaning (inputs, secondary buttons).
- radius-sm 4 (badges, toggle knob) · radius-md 6 (buttons, inputs, menus, drop slot) · radius-lg 10 (photos, hotel cards, brief card, sheet). Nothing above 10px.
- One shadow only, `shadow-float: 0 8px 24px rgba(28,27,25,0.08)` plus a 1px line, for things that float: side sheet, menus, dragged stop.
- Surfaces: surface → raised (inputs, panels) or sunken (headers, hover). Never raised on sunken.

### Components
- **Buttons** 40px tall, 14px/600, radius-md. Variants: primary (indigo), secondary (raised + line-strong), quiet (text + icon), destructive (danger outline). One primary per screen. Sign-in and mobile primaries 48px. Focus: 2px indigo ring, 2px offset.
- **Inputs** label above (label token), 8px gap, 40px tall, raised ground, line-strong border, single column max 560px. Assumed values sit on indigo-soft with an "Assumed" caption. Error: danger border + caption.
- **Toggle** 36×20 track, 16px knob. **Segmented control** sunken track, active segment raised with hairline.
- **Status** is a dot + word: Draft (ink-muted), Sent (amber), Confirmed (green), Lost (ink-muted, row text muted). Save state: "Saved · 12:41" green, "Saving…", "Unsaved changes" amber, "Not saved · Retry" danger.
- **Badges** tinted ground, radius-sm: Verified (green-soft), Verify before sending (amber-soft), neutral (sunken) e.g. "3 nights". Initials avatar is the only pill.
- **Table** 52px rows, 40px header on surface-sunken, hairline between rows, no zebra, no outer border, no cards. First column heading-3, others body-sm ink-secondary. Row hover: sunken ground, quick actions revealed at right edge (Open, Duplicate, Copy link, PDF).
- **Photos** fixed ratios: day hero 3:2, hotel 4:3, list thumb 1:1. radius-lg, 1px line outline, object-fit cover. Caption bottom-left inside the frame in caption/ink-secondary on a slightly darker ground. While loading or missing: one of the four photo grounds (rotated by index) with the place name. Never a broken-image glyph, never text over photos otherwise, never overlays.
- **Top bar** 56px, surface, hairline below: agency name (left), text nav (Itineraries · Settings), primary action + initials (right). No sidebar.

### Never do
No sidebar, stat cards, icons in coloured circles, dashed empty states, illustrations, gradients, glassmorphism, photo overlays, text over photos, pure black/white, pills (except initials), radius > 10px, shadows other than shadow-float, second accent, indigo headings, weight 700, italics, positive tracking outside labels, emoji, exclamation marks, chatty AI copy.

## Screen map (PNG → route)
| PNG | Route | Notes |
|---|---|---|
| 04, 05, 17 | `/login` | Split layout: Pexels hero left (caption bottom-left), form right. Mobile stacks hero on top. "Resend in 0:42" countdown, "Use a different email". |
| 06, 07, 18 | `/app` | Compact list; summary line "57 itineraries · 21 waiting on a client reply · 3 viewed today"; tabs with counts; sort; "Show 43 more". Empty state is display-1 copy + three numbered steps, no box. Mobile: cards with a bottom sheet of actions. |
| 08 | `/app/new` step 1 | Focused textarea, Ctrl+Enter hint, three example prompts as a hairline list. |
| 09 | `/app/new` step 2 | "Check the brief": assumed fields on indigo-soft with reason captions; budget and pace as segmented controls; must-sees list with removable rows; notes. |
| 10 | `/app/new` step 3 | Progress: elapsed/left bar, four steps with results, "Drafted so far" day list appears as soon as drafting completes. |
| 11, 12, 13, 19 | `/app/i/[id]` | Left: title, meta, day pill-less tab strip, days in sequence (day label column, heading-1 title, hero, transport line, stops with time/duration, hotel card, Regenerate this day). Right panel (raised, 320px): client, dates and travellers, pricing, inclusions, exclusions, payment terms, cancellation. Dragged stop uses shadow-float; drop slot is indigo-soft dashed. Swap: inline search within the hotel card, results list with photo thumb, name, address. Collapsed days show thumb + summary row. Mobile: two tabs "Days" and "Details and price". |
| 14 | Share sheet | Right sheet 380px: link toggle + copy, WhatsApp primary with message preview + Edit message, PDF row with preparing state, client activity (views, last viewed with device), status as 2×2 radio cards, amber notice listing unverified hotels. |
| 15 | `/app/settings` | Two-column form with section labels in the left gutter; live client-header preview on the right. |
| 16 | `/admin` | Tenant table with usage, inline "Suspend" with type-to-confirm panel, create-tenant card on the right. |

## Agreed deviations from the PDF (build these, not the picture)
1. **Hotel swap results show no rating or review count.** The PDF shows "4.5 · 1,920"; our Places field mask excludes rating (it re-prices every call). Show photo thumb, name, address only. Revisit in Phase 8 with a separate Enterprise-SKU call for the swap search only.
2. **Pricing panel: no automatic GST calculation.** Replace "GST 5% included" with an optional free-text "Tax note" line (e.g. "GST 5% included") shown under the total. No percentage maths in v1.
3. **Client activity: no "Most time spent on Day 2 and Pricing".** Show views count, last viewed time, and device (mobile/desktop) only.
4. **Super-admin: no "Agents" column, no "Staff" nav.** Single user per tenant in v1. Keep "Trial" as a tenant status alongside Active/Suspended. Caps shown are AI calls/month and PDFs/month (map to `daily_gen_cap` plus a new `monthly_pdf_cap`).
5. **Tenant subdomains** read `<slug>.planner.smallsoftware.in` in copy, not `.daywise.in`, until the domain is bought. Keep the UI string in one config constant.
6. **Settings adds fields** the PDF shows and the schema lacked: `website`, `gstin`, `licence_no` (both optional, printed in footer when present), theme colour presets (six swatches + hex).
7. **Client block adds** optional `referred_by` and `city`.
8. **Mobile list** uses a `...` bottom sheet for actions; desktop uses row-hover actions. Both exist.
9. **Login hero** is a cached Pexels image served from R2 with its caption; rotate between 4 fixed Indian destinations. Never a Google photo here.
10. **Sign-in copy** per PDF ("Welcome back", "Email me a sign-in link"), footer "support@" uses `SUPPORT_EMAIL` env, default `support@smallsoftware.in`.

## Implementation notes for Claude Code
- Install shadcn/ui via the CLI (`pnpm dlx shadcn@latest init`, then `add` what is needed) and override its CSS variables with the tokens above in `globals.css`; do not keep hand-written primitives that drift from the CLI versions.
- Put tokens in `@theme` so Tailwind utilities exist (`bg-surface-sunken`, `text-ink-secondary`, `border-line`, `rounded-lg` = 10px etc.). Map `--radius` so `rounded-md` is 6px and `rounded-lg` is 10px.
- Build a small `src/components/ds/` layer on top of shadcn: `StatusDot`, `Badge` variants, `PhotoFrame` (ratio + ground rotation + caption), `SectionLabel`, `TopBar`, `Sheet` wrapper with shadow-float, `SegmentedControl`.
- Load Inter via `next/font` with weights 400/500/600 and `font-feature-settings: "tnum"` on numeric elements.
- Every screen must be checked against its PNG at 1440 and, where a mobile PNG exists, at 390 before the phase is marked done.
