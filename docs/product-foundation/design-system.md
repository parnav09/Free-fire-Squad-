# SQUAD OS Design System

The canonical tokens are in src/styles/tokens.css; responsive and interaction contracts are in src/styles/foundation.css.

## Visual direction
Premium, restrained esports operations UI. Use deep onyx as the dominant field, cool neutral text, cyan for primary interaction and violet as a secondary accent. Avoid excessive neon glow, saturated gradients behind large text, and decorative borders that compete with data.

## Color grading
- Canvas: #05060B
- Surface: #080B14
- Raised surface: #0B1020
- Elevated surface: #10182A
- Primary text: #EEF3FF
- Secondary text: #B0BDD5
- Muted text: #8493AD
- Cyan: #70D8ED
- Violet: #9B86F4

The palette is designed for a dark interface. Do not infer accessibility from color choice alone; verify actual text/background pairs when components are finalized.

## Layout
- Desktop: persistent left navigation, sticky topbar, content capped at 1240px.
- Tablet: compact left navigation and two-column information grids.
- Phone: horizontally scrollable bottom navigation, safe-area inset, one-column forms and compact two-column cards.
- Short landscape phone: shorter bottom navigation with content clearance.

## Interaction
- Minimum standard target: 44px.
- Use visible focus indicators.
- Preserve keyboard and pointer access.
- Never use color as the only status signal.
- Respect reduced motion.
