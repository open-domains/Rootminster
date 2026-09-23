# Site themes

Open **Choose appearance** (the palette icon) in the navigation or **Appearance** on sign-in screens.

- **Tabler** uses Tabler's dashboard components and the configured brand accent. Existing saved `classic` preferences map to Tabler.
- **Fieldwork** uses warm paper surfaces, forest-green accents, DM Sans interface text and Instrument Serif marketing headings. Its dark mode uses deep green surfaces and a pale sage accent. Operational screens retain compact, readable sans-serif headings and tabular numbers.
- Light, Dark and System are independent of the selected theme. System follows operating-system changes live.

Preferences are per browser, shared across routes and tabs. Existing `od_theme` light/dark preferences are retained. `rootminster_style` stores the style. Invalid values fall back to Classic/System; blocked storage still permits changes for the current visit.

## Implementation

`src/lib/theme.js` defines the registry and storage/application functions. `ThemeContext.jsx` owns shared React state. `main.jsx` applies stored preferences before rendering, and the provider maintains the root `data-theme` attribute and `dark` class. Portaled dialogs, menus, and both toast systems inherit the same tokens. Sonner also receives the resolved color mode.

`src/themes/fieldwork.css` defines the second identity, in both modes, plus scoped marketing treatments. Tabler's CSS loads from `@tabler/core`, with bridges for existing Tailwind/Radix components in `src/themes/tabler.css`. BrandRuntime applies administrator-selected accent colors to Tabler and restores them when returning from Fieldwork. Branding names and logos remain shared.

To add a theme, register its ID, name, and description in `THEMES`, add its scoped light/dark CSS token definitions, and provide a `.theme-swatch--<id>` preview. Include background, foreground, surfaces, interaction, chart, and sidebar tokens. Avoid selectors tied to a route's Tailwind utility ordering; use named component classes for composition changes.

Fieldwork combines the installed skills' applicable guidance on editorial typography, consistent tokens, accessible controls, understated motion and incremental redesign. Conflicting visual styles are resolved into a single identity. Mobile-native, Swift and image-only workflows are outside this web theme's implementation.

## Verification

Run `node --test tests/theme.test.js`, `npm run lint`, `npm run typecheck`, and `npm run build`.

Browser checks should cover all four style/color combinations, System updates, reloads, navigation to public and authentication pages, cross-tab updates, keyboard menu navigation, reduced motion, and narrow viewports. For authenticated routes, use a configured backend or explicit test fixtures.
