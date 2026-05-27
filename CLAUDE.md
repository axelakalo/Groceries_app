# PantrySync — Project Instructions for Coding Agents

## What this is
A PWA for a household (2 people) to share a grocery list and track pantry expiration dates.
Mobile-first. Dark theme. Blue accent.

## Tech
Vite, React, TypeScript, Tailwind, React Router, Supabase (Auth + Postgres + RLS + Edge Functions),
Open Food Facts (server-side only), html5-qrcode, date-fns, vite-plugin-pwa.

## Non-negotiable rules

1. **PWA only.** No native code, no Capacitor, no App Store assumptions.
2. **No secrets in the frontend.** Service role key, Resend API key, and any provider keys
   live in Edge Function env vars only. The anon key is the only Supabase key in the client.
3. **RLS is the source of truth for authorization.** The frontend never decides who can read what.
   Every household-scoped table has RLS enabled with policies that check membership via the
   `is_household_member()` SECURITY DEFINER function (see schema).
4. **`household_id` is never user-editable in forms.** It is derived from the active household
   context on the server side or via RLS.
5. **Expiration date is always manually typed or selected.** Barcode lookup fills product
   metadata (name, brand, image, category) only — never expiration.
6. **Expiration is nullable.** Some items (salt, sugar, vinegar) don't expire. NULL means
   "doesn't expire" and those items are excluded from expiring-soon queries.
7. **Service worker caches static assets only.** Never cache `*.supabase.co` responses,
   never cache auth tokens, never cache household data.
8. **Realtime is scoped to the grocery list.** Pantry uses refetch-on-focus.
9. **Camera access only on explicit user gesture.** iOS Safari will refuse otherwise.
10. **All saved dates are ISO `YYYY-MM-DD` strings.** All date parsing goes through `src/lib/dates.ts`.
11. **Barcodes are validated:** digits only, 8–14 characters, after stripping spaces/hyphens.
12. **Per-phase work only.** Do not chain phases together in a single response. Stop after
    the phase's acceptance checks and wait for the user to verify.

## UI conventions
- Mobile-first, dark background, rounded cards, blue accent.
- Bottom tab navigation on mobile, sidebar on desktop ≥ 768px.
- Large tap targets (min 44×44pt).
- Toasts for confirmations. Modals for destructive actions.
- Empty states are always written (no blank screens).
- Loading states are skeleton-based, not spinners.

## Before completing any task
- `npm run typecheck` passes (or `tsc --noEmit`).
- `npm run lint` passes if configured.
- No `console.log` left in production paths.
- No secrets in committed files.
- If DB changed: migration written, RLS policies updated, helper function used (no inline
  `exists` subqueries on `household_members` from policies on `household_members` itself —
  that recurses).
- Summary of changed files + manual test steps at the end of the response.
