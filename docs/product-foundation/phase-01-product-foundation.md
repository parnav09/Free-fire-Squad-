# Phase 01 — Product Foundation

**Project:** SQUAD OS  
**Status:** Foundation baseline implemented; final acceptance is pending verification.  
**Scope rule:** This phase establishes the product, repository, runtime, design and QA foundation. It does not implement or repair later-phase tournament, training, map, replay, analytics, offline-sync or notification workflows.

## 1. Product definition

SQUAD OS is a mobile-first web application for managing one Free Fire competitive squad. It supports team operations, weekly match records and player development. It is not a public discovery feed, a game client, a tournament organizer for unrelated teams, or a replacement for official tournament systems.

### Primary users
- Team owner / administrator
- Coach / analyst
- IGL
- Player

### Product principles
1. Team data must be scoped to the correct team.
2. Shared team records must not be confused with device-local drafts.
3. A visible control must have a real, understandable action.
4. Save and synchronization states must be distinguishable.
5. Mobile touch interaction is a first-class requirement.
6. Historical competition records must not be silently overwritten.
7. Product UI language is English.
8. The interface uses deep onyx surfaces, restrained cyan/violet accents and readable text.
9. Avoid paid infrastructure assumptions; deployment must remain compatible with free-tier hosting, without promising that providers will keep free tiers forever.

## 2. Phase boundaries

### Included in Phase 01
- Product purpose, user roles and non-goals
- Repository and build conventions
- Runtime entry point and application-level crash fallback
- Semantic design tokens and theme aliases
- Responsive shell standards for desktop, tablet, phone and landscape phone
- Touch-target, focus, safe-area and reduced-motion standards
- Environment-variable naming and secret-handling conventions
- Foundation verification script and CI build gate
- Architecture decision records and phase acceptance rules

### Explicitly excluded
These belong to later phases and must not be marked complete by Phase 01:
- Unified cloud roster and capacity changes (Phase 02/03)
- Tournament registration and 7 × 6 lifecycle (Phase 04/05/08)
- Match scoring and verification rules (Phase 06/07)
- Training, drill and communication workflows (Phase 10/11/12)
- Map intelligence (Phase 13)
- Error and replay systems (Phase 14/15)
- Analytics and reports (Phase 16/17)
- IndexedDB, durable offline queue and conflict resolution (Phase 18)
- Notifications and automation (Phase 19)

## 3. Repository baseline

- React + TypeScript + Vite
- Supabase browser client uses only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
- Secret/service-role keys must never be placed in VITE_* variables or browser source
- Node engine range: >=22.12.0 <27
- TypeScript strict mode remains enabled
- Production build runs TypeScript validation before Vite bundling
- npm run test:foundation runs dependency-free Node tests for foundation contracts
- CI must run foundation tests and production build on pull requests and pushes to main

## 4. Design system

### Palette
| Token | Value | Purpose |
|---|---|---|
| Onyx 950 | #05060B | App canvas |
| Onyx 900 | #080B14 | Main surface |
| Onyx 850 | #0B1020 | Raised surface |
| Onyx 800 | #10182A | Elevated surface |
| Cyan 400 | #70D8ED | Primary accent |
| Cyan 300 | #A1E9F5 | Highlight accent |
| Violet 400 | #9B86F4 | Secondary accent |
| Text primary | #EEF3FF | Main text |
| Text secondary | #B0BDD5 | Supporting text |
| Text muted | #8493AD | Metadata |
| Success | #79D9B2 | Success state |
| Warning | #EDC779 | Warning state |
| Danger | #FF8999 | Destructive/error state |

Use accents to identify state and hierarchy, not as large glowing fills. Text contrast takes priority over decoration.

### Surface rules
- Canvas: deepest onyx.
- Cards: one surface step above canvas.
- Elevated panels: one additional step above cards.
- Borders: subtle neutral blue-grey, not bright outlines on every card.
- Cyan: primary action/focus/selected state.
- Violet: secondary accent and limited decorative emphasis.
- Status colors: success, warning and danger only for meaningful states.

### Motion
- Fast: 140ms.
- Standard: 190ms.
- Slow: 260ms.
- Respect prefers-reduced-motion.
- Never use motion as the only indicator of state.

## 5. Responsive layout contract

| Target | Width / condition | Expected behavior |
|---|---|---|
| Small phone | 320–380px | No horizontal page overflow; compact content; scrollable bottom navigation |
| Phone | 381–620px | Bottom navigation with safe-area padding; single-column forms; two-column cards where readable |
| Tablet | 621–1024px | Narrow sidebar; two-column data grids; comfortable gutters |
| Desktop | 1025–1199px | Persistent sidebar; flexible content width |
| Wide desktop | >=1200px | Expanded sidebar and content capped at 1240px |
| Landscape phone | <=900px wide and <=500px high | Reduced bottom-bar height; safe-area-aware content |

Responsive CSS is a contract, not proof of pixel-perfect rendering. Real browser/device screenshots and interaction tests are still required.

## 6. Interaction and accessibility contract

- Standard interactive targets are at least 44 × 44 CSS pixels.
- Small visual icons may be smaller only when their clickable parent meets the target size.
- Keyboard focus must remain visible.
- Focus must not rely on color alone.
- Form controls must have visible labels or accessible names.
- Dialogs must support focus management, Escape handling and focus restoration before their feature is signed off.
- Avoid accidental click-through and overlapping hitboxes.
- Disabled controls must visibly and semantically communicate their state.
- Use safe-area insets for mobile bottom navigation and overlays.
- Respect reduced-motion preferences.

## 7. Runtime resilience

The application entry point verifies the root mount exists. React rendering is wrapped in an application-level error boundary. The fallback provides a safe reload action and does not expose stack traces or secrets to the user.

This boundary catches React render/lifecycle errors; it does not replace network error handling, form validation, server monitoring or route-level recovery.

## 8. Quality gates

Run:
- npm run typecheck
- npm run test:foundation
- npm run build

Manual QA still required:
- 320px, 360px, 390px phone widths
- Android Chrome and installed PWA shell once PWA work is implemented
- Tablet portrait and landscape
- Laptop 1366px and desktop 1920px
- Keyboard-only navigation
- Touch target measurement and hitbox overlap checks
- Light/dark OS preference consistency (product remains intentionally dark)
- Error boundary fallback check

## 9. Current implementation notes

Implemented in the Phase 01 branch:
- Semantic brand and status tokens with legacy aliases
- Responsive foundation CSS for phone/tablet/desktop/landscape
- 44px interaction target normalization and larger notice-dismiss target
- Safe-area-aware mobile layout
- Focus-visible and reduced-motion rules
- Application error boundary
- Root mount guard
- Dark browser theme metadata
- Foundation static verification script
- CI workflow

Still required before Phase 01 can be honestly marked Complete:
1. CI must pass against the branch.
2. A real browser build must be reviewed at the viewport matrix above.
3. Existing primary workflows must be smoke-tested after the foundation CSS layer is added.
4. The monolithic App.tsx must be decomposed into feature/application modules without changing behavior.
5. A dependency lockfile and reproducible install strategy should be committed.
6. The mobile navigation and modal focus behavior must pass interaction testing.

## 10. Completion rule

Phase 01 is Complete only when every required foundation item passes automated and manual verification. Do not mark it complete because documentation exists or because the production deployment is green.
