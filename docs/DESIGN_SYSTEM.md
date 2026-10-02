# The Oreva Edit design system

The original direction is photographic and editorial: warm paper tones, a confident wine accent, large serif composition, thin rules and open product grids. The temporary text wordmark is a development asset.

## Tokens

| Role             | Value   |
| ---------------- | ------- |
| Background       | #faf8f3 |
| Surface          | #f0ece4 |
| Elevated surface | #fffdf8 |
| Foreground       | #292721 |
| Muted text       | #6b655e |
| Primary          | #62283a |
| Primary hover    | #491b2b |
| Accent           | #b3a384 |
| Border           | #dcd7ce |
| Focus            | #833c50 |
| Success          | #2f6249 |
| Warning          | #805511 |
| Destructive      | #a12d2d |
| Information      | #305f72 |

All values are CSS variables in app/globals.css. Decorative accent and border tones are not body text. Wine buttons use ivory text. Keyboard focus uses a 2px outline with offset.

Cormorant Garamond supplies the display, headings and temporary wordmark; Manrope supplies body copy, navigation, prices, forms and labels. Both use the SIL Open Font License, included locally. next/font/local serves them without third-party font requests. Hero 64–100px desktop / 70px mobile; page headings 44–70px; section titles 34–48px; readable form inputs become 16px on mobile. Labels/captions are intentionally small, supported by contrast and larger interactive targets.

Spacing follows 4/8/12/16/20/24/32/40/56/72px increments; layouts use max-width 1320px. Product photography is usually 3:4, category editorial 4:5, gallery 4:5. Radius is zero for commerce surfaces; no card shadows. Only overlays use a subtle shadow.

Lucide is the single primary SVG family, 1.5px stroke, with accessible names on icon-only controls. Buttons are rectangular with 48px minimum primary height. Inputs use visible labels, persistent inline errors and associations. Native dialog supplies modal focus trapping, Escape, inert background and focus restoration. Drawers use that same primitive at the viewport edge. Toasts are used only for brief confirmation; checkout failures stay inline.

Breakpoints: 600px phone composition, 800px navigation/filter switch, 1100px narrower desktop, 1500px large canvas. Mobile navigation is a nested drawer; mobile filters are a labelled drawer with shared controls. Product grids are 2 columns on phones, 3 in filtered catalogue desktop, 4 in home selections. Admin tables scroll inside their container.

Motion is limited to a 180–500ms colour/image/drawer response and loading pulse. prefers-reduced-motion removes nonessential animation and smooth scrolling. There is no scroll hijacking, optional tracking, autoplay or fake promotional urgency.
