# Public portal extension guide

This frontend is DB-backed. Add public content through the admin data model, not
by branching React components per section.

## Add a section

1. Add or edit the section in the admin panel, or in the backend seed for a
   clean database reset.
2. Choose a route, icon key, order, angle, visibility window and enabled state.
3. Add `sectionItems` owned by that section. The public renderer will show them
   through the generic overview and carousel.
4. Do not add section-specific branches in React unless the visual structure is
   genuinely new and reusable.

## Add a momentary tab

1. Add or edit a `momentaryTab` with id, label, icon key, order, angle and
   visibility.
2. Add `momentaryItems` owned by that tab.
3. The route is the tab id. Keep ids URL-safe and stable.

## Add a card visual

1. Extend the view model in `features/publicPortal/cards.ts` only if existing
   `ContentItem` fields cannot express the new visual.
2. Keep action labels, date formatting and optional fields normalized in the
   view model instead of inside JSX.
3. Keep external links going through `shared/externalLinks.ts`.

## Add animation

1. Prefer existing CSS and Three.js/WebGL primitives.
2. Put shared durations and tolerances in `features/publicPortal/constants.ts`.
3. Respect reduced motion and the existing performance governor.
4. Add Motion only for a specific interaction that is hard to maintain with CSS,
   and keep it scoped to that component.

## Style organization

Public CSS is imported from `src/styles.css` in visual-domain order:
foundation, orbits, section panel, carousel, legacy content, footer/keyframes,
admin, responsive overrides.
