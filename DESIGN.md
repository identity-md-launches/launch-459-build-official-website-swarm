# Swarm Pepe design system

## Overview

Swarm Pepe is a public, browser-rendered collection viewer and an Ethereum mint/reveal interface. Readers can explore every page without connecting a wallet. The visual identity follows the collection's existing [launch-449 video](artifacts/video-reference.md): a near-black field, faint square grid, viewport HUD, uppercase monospace text, cream headings, acid accents, orange rules, and framed pixel portraits.

The canonical implementation is [src/styles.css](src/styles.css), with page composition in [src/App.tsx](src/App.tsx), gallery behavior in [src/Gallery.tsx](src/Gallery.tsx), and shared art/link components in [src/components.tsx](src/components.tsx). The two-column Home hero is specific to Home; the reusable system is the HUD, restrained type hierarchy, aligned content edges, bordered controls, and flat token cards. The assignment's square corners, uppercase typography, and absence of gradients or shadows take precedence over generic design defaults.

## Colors

CSS uses hex primitives and role aliases in `:root`. There is one dark appearance, declared with `color-scheme: dark`; no alternate theme is implemented.

| Primitive | Value | Role / implemented use |
| --- | --- | --- |
| `--ink` | `#070b14` | `--color-bg`: page, HUD, field fill, text on primary actions |
| `--panel` | `#0e1520` | `--color-surface`: cards, notices, filters, mint and reveal panels |
| `--panel-hover` | `#172230` | Neutral button hover fill |
| `--cream` | `#e8e4c9` | `--color-text`: primary text; primary action hover fill |
| `--slate` | `#9aa8b9` | `--color-muted`: secondary text, descriptions, metadata, disabled text |
| `--line` | `#334253` | `--color-border`: structural frames, separators, disabled control borders |
| `--control-line` | `#687c90` | Enabled field/button borders; pressed button fill |
| `--acid` | `#c8d94a` | `--color-accent`: primary action, active navigation, focus, selected-card border, live status and alternating card rules |
| `--orange` | `#e8873a` | `--color-notice`: errors, waiting/offline status, hero separator, alternating card rules |

The page grid is a repeating inline SVG, 24 × 24 CSS pixels, with `#748ca8` strokes at `.075` opacity. It is decorative and contains no artwork. Status is also written in text: color alone does not carry mint, reveal, RPC, or token state.

Measured WCAG contrast pairs are recorded in [artifacts/contrast-results.json](artifacts/contrast-results.json): cream/panel 14.28:1, slate/panel 7.57:1, acid/panel 11.75:1, orange/panel 6.94:1, ink/acid 12.63:1, and control border/panel 4.25:1. The conservative grid-background pair uses `#0f151f`, giving slate/grid 7.56:1. These values describe those named pairs, not a claim that every possible composited state was measured.

## Typography

All visible type is monospace and uppercased with root `text-transform: uppercase`. There is no decorative letter spacing or eyebrow-label system. Numbers use `font-variant-numeric: tabular-nums`; text remains selectable. Root smoothing is enabled once.

| Role | Implementation |
| --- | --- |
| Body and controls | `--font-mono: 'Courier New', Courier, monospace`; regular 400; native/system bold 700 for small headings and primary actions |
| Display headings and numbers | `--font-display: 'VT323', 'Courier New', monospace`; VT323 regular 400 |
| Root | 16px, line-height 1.6 |
| Body | `--text-body: .9375rem` (15px); About paragraphs are 1rem/1.8 above 480px |
| Labels / buttons | `--text-label: .875rem` (14px); button line-height 1.4 |
| Captions | `--text-small: .8125rem` (13px); compact HUD/meta roles use 12px, with some mobile chrome at 10–11px |
| Inputs / selects | 1rem (16px) at every width |
| Standard `h1` | `clamp(3.5rem, 8vw, 6.5rem)`; line-height 1.1 |
| Standard `h2` / `h3` | 2.5rem display / 1rem bold system mono; `h3` line-height 1.4 |
| Home title | `clamp(6rem, 11.2vw, 10rem)`, line-height .79; 6rem on small phones |
| Token number | 2rem/1.1; hero 2.75rem, reduced to 2.25rem on phones |
| Minted counter | 3.75rem/1; maximum supply 2rem |

The only bundled face is [public/vt323-latin.woff2](public/vt323-latin.woff2), 17,936 bytes, loaded by `@font-face` with `font-display: swap`. Its SIL Open Font License is in [public/FONT-LICENSE.txt](public/FONT-LICENSE.txt). No font service is contacted. The source font URL is handled by Vite's relative-base production build.

Headings use `text-wrap: balance`. About prose is capped at 66ch; mint introduction paragraphs at 36ch, expanding to 56ch in the stacked layout; reveal explanation text at 86ch. Addresses use `.break-address { overflow-wrap: anywhere; }` so the full value remains available.

## Layout

The central `main` has a maximum border-box width of 1288px, 36px desktop side padding, and 124px bottom padding to clear the fixed footer. Navigation uses a 1360px maximum width. Common spacing is 8, 12, 16, 20, 24, 28, 32, 40, 56 and 64px; it is expressed in component declarations rather than a separate spacing-token scale. Card/field groups use smaller internal gaps than the spaces between sections.

The desktop Home hero has equal `minmax(0, 1fr)` columns and shrinkable children, so a previously large image cannot widen a phone viewport; the portrait column caps at 482px. Mint and About use `.9fr 1.1fr`. `.section-heading` and `.control-row` wrap, keeping actions reachable when text or content grows. The gallery displays 24 records per page in a responsive grid, with a page select and Previous/Next controls. Token selection survives page changes within the gallery.

| Width condition | Implemented adaptation |
| --- | --- |
| Above 1100px | Gallery and Home showcase each use four columns. |
| At most 1100px | Gallery becomes three columns; showcase two; large section gaps reduce to 32px; mint controls stack. |
| At most 760px | Gallery becomes two columns; filters stack; Home hero, mint section, and About stack. Hero copy temporarily uses two columns with the supply counter beside the description. Side padding becomes 28px. Navigation wraps; About's decorative code mark is hidden. |
| At most 480px | Gallery becomes one column; showcase remains two compact columns. Hero copy becomes a normal block. Main side padding is 24px and bottom padding 140px; address form and mint controls stack; wallet control spans the row. HUD frame inset reduces from 12px to 8px. Secondary footer description and navigation numbers are hidden. |
| At least 1380px | The additional footer phrase becomes visible. |

The gallery remains a reading column on a phone; it does not require a sideways carousel. Trait details and reveal controls use native disclosure elements. The fixed frame does not intercept input. Exact rendered viewport coverage and remaining browser limitations belong to [artifacts/validation.md](artifacts/validation.md), rather than being inferred from these CSS rules.

## Elevation & Depth

The interface is deliberately flat. There are no shadows, gradients, backdrop filters, or floating card effects. A slightly lighter surface separates cards and task panels from the grid. Structural borders are 1px; active-navigation and card-caption rules are 2px.

`.hud-header` is sticky at the top with z-index 10. `.hud-footer` is fixed with z-index 15. The noninteractive `.viewport-frame` is fixed with z-index 20 and `pointer-events: none`. The focus-revealed `.skip-link` sits above them at z-index 30. Opaque HUD backgrounds keep text legible over scrolled content.

## Shapes

Controls and cards are rectangles with square corners. Inputs, selects and buttons explicitly have zero radius. Live status is a 6px square; token artwork keeps its square geometry. The 1px viewport rectangle, 24px background grid and 2px rules repeat the video's HUD geometry without adding ornamental containers.

Artwork is always the contract-returned inline SVG. `PixelArt` measures its available container width with `ResizeObserver`, rounds down to a multiple of the renderer's 24px source grid, and applies explicit equal image width/height. The maximum is 384px for `hero` and 240px for ordinary cards, with a minimum of 24px. CSS sets `image-rendering: pixelated`; the image is never stretched with a percentage width or a scaling transform.

## Components

| Component / pattern | Source and behavior |
| --- | --- |
| HUD and navigation | `App` in `src/App.tsx`; shared `.hud-header`, `.nav-bar`, `.hud-footer`. Hash navigation keeps the static export independent of server rewrites. Current navigation uses `aria-current="page"`, acid text and a 2px underline. Route changes focus the main content. OpenSea and X are quiet footer links. |
| Buttons and fields | Global rules in `src/styles.css`. Neutral actions are bordered; `.primary` is the filled acid action. Buttons are at least 44px high; fields 46px, with visible labels and 16px text. Disabled states use native `disabled` and accompanying explanations. Hover styles are limited to hover-capable devices; pressed controls change fill rather than scale. |
| Focus and selection | Global `:focus-visible` has a 2px acid outline and 5px offset. Forced-color mode uses the system `Highlight`. Text selection uses acid fill with ink text. The first keyboard link skips to main content. |
| `PixelArt({ token, hero? })` | Exported from `src/components.tsx`; uses the token's on-chain data URI, descriptive alt text, integer sizing and eager hero/lazy card loading. Reuse this component for every collection portrait. |
| Token card / `Showcase` | `.token-card`, `.token-meta`, `.token-id` / `.token-number`; `Showcase` is a local pattern in `src/App.tsx`. A dark 1px frame encloses centered art and a caption with a 2px acid/orange rule. `.hero-card` uses an acid border and extra padding. Gallery cards add pending selection, native trait details and explorer links. |
| Allowlist and mint panel | Local `Allowlist` and `AllocationStats` in `src/App.tsx`. Address form has inline validation, a status result, and allowance/minted/remaining counts. The amount selector offers all remaining slots or a smaller amount. The connected wallet, network, owner, mint-open and allocation states determine the action and explanation. |
| Gallery | Exported `Gallery` in `src/Gallery.tsx`; receives collection, wallet and transaction state. Status filtering can use progressively loaded records. Trait filters and percentages wait for the complete snapshot. Missing records show a reading/retry state, never substitute artwork. A reveal disclosure holds persistent cross-page selection and single-batch actions. |
| Notices and transaction state | `.notice`, `.notice.error`, `.transaction-status`, `.global-status`; RPC and transaction failures are visible text with recovery where available. Routine progress uses status regions; errors use alerts. Transaction feedback distinguishes wallet confirmation, sent, confirmed and failed states. |
| `ExternalLink({ href, children, className? })` | Exported from `src/components.tsx`; opens a new tab with `rel="noreferrer"`, a decorative arrow and screen-reader text announcing the new tab. Gallery token links also carry token-specific accessible names. |

Native buttons, links, selects, checkboxes and details supply keyboard behavior. There are no dialogs, custom focus traps, drag interactions, autoplay or interface animations to configure. RPC loading, empty collection/filter results, missing art, disconnected/wrong-network wallets and disabled transactions all retain usable page structure.

## Do's and Don'ts

- Start a new page inside the existing `App` main/HUD structure, with one page `h1`, `.section-heading` where appropriate, and existing role colors. Keep hash navigation for static hosting.
- Use a bordered neutral action for peers and one filled `.primary` action for the main transaction in a task panel. Keep error explanations beside the affected flow.
- Render every token through `PixelArt`; keep real metadata and art in their contract-returned data URIs. Do not add snapshot portraits, external image hosting, invented traits or precomputed rarity.
- Keep token numbers tabular, controls labelled, addresses wrappable and disclosures native. Recheck 320px reflow when adding content.
- Preserve square corners, flat surfaces, the restrained palette and uppercase monospace typography. Do not add shadows, gradients, serif text, rounded cards or letter-spaced heading eyebrows.
- Do not add animation or CSS transforms to pixel artwork. Extend actual component patterns instead of duplicating the art-sizing logic.
