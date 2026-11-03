# Rootminster visual themes

The existing Classic style remains the default. Themes change presentation; product content, navigation and account workflows stay shared.

## Classic

Inter typography, neutral light surfaces and navy dark surfaces, existing rounded components. The administrator's configured primary color overrides the base blue accent.

## Fieldwork

A quiet editorial identity for people publishing projects and managing DNS. Marketing uses Instrument Serif display text (48–86px, 1.02 line height, -0.025em tracking), while DM Sans carries the interface. Data stays compact and uses tabular numerals. Desktop marketing juxtaposes display text and a DNS workspace preview; mobile stacks these without changing reading order.

Light palette: canvas `hsl(42 30% 96%)`, ink `hsl(150 16% 16%)`, paper `hsl(42 35% 99%)`, forest accent `hsl(155 37% 28%)`, secondary text `hsl(150 8% 38%)`.

Dark palette: canvas `hsl(155 15% 9%)`, ink `hsl(42 24% 91%)`, surface `hsl(155 13% 12%)`, sage accent `hsl(144 30% 70%)`, secondary text `hsl(140 10% 67%)`.

Controls have 6px corners and no decorative shadow. Containers use the 12px radius token. Borders define surfaces. Primary button press feedback scales to 0.97 over 160ms with `cubic-bezier(0.23, 1, 0.32, 1)`; reduced motion disables the transform. Appearance selection uses existing Radix keyboard and focus behavior, labeled radio groups, and textual selection indicators alongside swatches.

Source of truth: `src/themes/fieldwork.css`; shared preference behavior and extension instructions: `docs/themes.md`.

## Signal

A monochrome developer-infrastructure identity with one live accent. Space Grotesk carries display and interface text; JetBrains Mono carries labels, hostnames and record data with tabular numerals. Marketing headlines are oversized (`clamp(3.25rem, 9.5vw, 8.5rem)`, 0.9 line height, -0.055em tracking) and span the desktop grid, with the lead copy and DNS workspace sharing the row beneath. Section rhythm varies deliberately: a dotted hero field, one full-bleed inverted step band with outlined numerals, a hairline bento feature grid and an oversized closing call to action.

Light palette: canvas `hsl(240 8% 97%)`, ink `hsl(240 10% 8%)`, surface `hsl(240 10% 99%)`, signal accent `hsl(14 88% 42%)`, secondary text `hsl(240 4% 36%)`. The step band inverts to graphite.

Dark palette: canvas `hsl(240 6% 6%)`, ink `hsl(40 10% 93%)`, surface `hsl(240 5% 9%)`, signal accent `hsl(18 100% 60%)` with graphite text on accent fills, secondary text `hsl(240 4% 65%)`. The step band becomes a full accent field.

Controls use 4px corners; containers use the 6px radius token. Motion uses `cubic-bezier(0.16, 1, 0.3, 1)`: a staggered 700ms hero entrance, an underline that draws beneath the headline accent, once-per-section scroll reveals where CSS scroll-driven animations are supported, 150ms button press scaling to 0.97, and hover-only accent lines on feature cards. Reduced motion removes every transform and animation. Key text pairs meet WCAG AA in both modes.

Source of truth: `src/themes/signal.css`.
