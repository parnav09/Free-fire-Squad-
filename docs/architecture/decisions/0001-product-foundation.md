# ADR 0001 — Product foundation conventions

- **Status:** Accepted for Phase 01
- **Date:** 2026-11-08

## Context
SQUAD OS currently uses React, TypeScript, Vite and Supabase. The initial application is concentrated in a large App component and a large stylesheet. The project needs stable design/runtime conventions before additional modules are added.

## Decisions
1. Keep React + TypeScript + Vite for the current web application.
2. Keep Supabase publishable credentials browser-side only; secrets remain server-side.
3. Centralize semantic palette, typography/interaction and layout tokens.
4. Keep the existing legacy CSS aliases during migration to avoid a destructive all-at-once visual rewrite.
5. Add an application error boundary and explicit root mount check.
6. Standardize responsive behavior for phone, tablet, desktop and short landscape phone.
7. Use 44px minimum standard interaction targets.
8. Run TypeScript validation, foundation contract tests and production build in CI.
9. Decompose the monolithic app incrementally behind behavior-preserving tests; do not combine architecture refactors with unrelated feature changes.

## Consequences
- Existing screens inherit the new foundation layer without rewriting every feature component immediately.
- Some old component styles may still override the semantic tokens and must be migrated incrementally.
- Browser-level visual and interaction tests remain necessary before full sign-off.
