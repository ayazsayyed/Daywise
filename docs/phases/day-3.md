# Day 3 — Editor

## Goal
Agent generates from the UI, reviews the brief, edits everything, and it all persists.

## Build
1. **New itinerary flow** `/app/new`: prompt box → enhancer → **brief confirmation form** (assumed fields highlighted amber) → Generate → progress screen polling job state (enhancing / drafting / verifying / adding photos) → opens editor.
2. **Editor** `/app/i/[id]` (client component tree): day columns or vertical list; dnd-kit sortable for days and for stops within/between days; add/remove day (dates reflow); inline edit of titles, summaries, stop descriptions, transport line; autosave with debounce + "Saved" indicator; optimistic updates via Server Actions.
3. **Hotel card per day:** name, image, address, room type, meal plan select, check-in/out; **Swap** opens Places search (text search, show 5 results with photo) or **Enter manually**; verified/unverified badge "Verify before sending".
4. **Regenerate day** button → job regenerates only that day within the itinerary context.
5. **Client block** + **Pricing panel**: mode toggle total / per person / per adult+child, INR, show/hide on share. **Sections**: inclusions, exclusions, payment terms, cancellation — prefilled from tenant defaults.
6. **Dashboard** `/app`: list with search, status filter, destination/dates/client columns; quick actions open / duplicate / copy link (disabled until Day 4) / PDF (disabled until Day 4). Duplicate and Save-as-template / Start-from-template.
7. **Learning capture:** on hotel swap or manual stop add, write `tenant_learnings` row.
8. **Soft delete** with confirm.

## Accept
- [ ] Prompt → brief → itinerary in the UI end to end
- [ ] Drag a day up, drag a stop across days, swap a hotel, edit text, change pricing mode, reload — everything persisted
- [ ] Regenerate Day 3 changes only Day 3
- [ ] Duplicate creates an independent copy; template has no client/dates
- [ ] Works on a 390px-wide phone for viewing/light edits
