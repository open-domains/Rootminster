# Rootminster visual themes

Tabler is the default style for the user and admin UI, forms and email. Themes change presentation; product content, navigation and account workflows stay shared.

## Tabler (stored as `classic` for existing browser preferences)

Inter typography, Tabler cards, buttons, tables, form controls and icons, neutral light surfaces and navy dark surfaces. The administrator's configured primary color overrides the base blue accent. The existing React and Radix controls retain their behaviour and keyboard handling. Email clients receive an inline-styled Tabler-inspired card wrapper from `server/lib/tabler-email.js`.

## Fieldwork

A quiet editorial identity for people publishing projects and managing DNS. Marketing uses Instrument Serif display text (48–86px, 1.02 line height, -0.025em tracking), while DM Sans carries the interface. Data stays compact and uses tabular numerals. Desktop marketing juxtaposes display text and a DNS workspace preview; mobile stacks these without changing reading order.

Light palette: canvas `hsl(42 30% 96%)`, ink `hsl(150 16% 16%)`, paper `hsl(42 35% 99%)`, forest accent `hsl(155 37% 28%)`, secondary text `hsl(150 8% 38%)`.

Dark palette: canvas `hsl(155 15% 9%)`, ink `hsl(42 24% 91%)`, surface `hsl(155 13% 12%)`, sage accent `hsl(144 30% 70%)`, secondary text `hsl(140 10% 67%)`.

Controls have 6px corners and no decorative shadow. Containers use the 12px radius token. Borders define surfaces. Primary button press feedback scales to 0.97 over 160ms with `cubic-bezier(0.23, 1, 0.32, 1)`; reduced motion disables the transform. Appearance selection uses existing Radix keyboard and focus behavior, labeled radio groups, and textual selection indicators alongside swatches.

Source of truth: `src/themes/fieldwork.css`; shared preference behavior and extension instructions: `docs/themes.md`.
