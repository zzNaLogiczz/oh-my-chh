# Liquid Glass Theme Design

## Source of truth

- Status: Active — theme-scoped contract for `src/theming/themes/liquid-glass`.
- Last refreshed: 2026-06-14
- Primary product surfaces:
  - Chiphell portal home (`portal-home`)
  - Portal category/list pages (`portal-list` semantic hooks under `portal-home` route)
  - Forum index (`forum-index`)
  - Thread list (`thread-list`)
  - Thread detail (`thread-detail`)
  - Article view (`article-view`)
  - User profile (`profile`)
  - Compose / reply surfaces (`compose`)
  - Global header, search, quick navigation, footer, and floating action rail
- Evidence reviewed:
  - `README.md` — extension scope, safety constraints, route QA targets, and DOM-adapter strategy.
  - `src/theming/themes/liquid-glass/theme.json` — current theme identity, capabilities, and supported routes.
  - `src/theming/themes/liquid-glass/index.css` — theme entrypoint composition (imports `tokens.css`, `routes.css`, `rank-badges.css`; this combined file is what `manifest.json` ships and what the build inlines).
  - `src/theming/themes/liquid-glass/tokens.css` — theme enablement hook.
  - `src/theming/themes/liquid-glass/routes.css` — implemented visual language, route rules, component treatments, responsive behavior, dark mode, and reduced-motion rules. Holds the `:root` token block and all `--chh-lg-*` tokens.
  - `src/theming/themes/liquid-glass/rank-badges.css` — user-rank badge / heraldic effects layered onto thread-detail author cards.
  - `src/foundation/semantics/*.ts` — theme-agnostic semantic class/data hooks and route-specific enhancement boundaries.
  - `src/foundation/route.ts` — route taxonomy.
  - `src/theming/assets.ts` — required HTML dataset hooks, theme asset links, and theme scoping.
  - `src/theming/catalog.ts` / `src/theming/registry.ts` — theme metadata and runtime module registration.
  - `src/theming/themes/liquid-glass/adapter/*` — Liquid Glass-specific DOM rendering, header reconstruction, and rank emblem effects.
  - `src/preferences/schema.ts` / `src/preferences/settings.ts` — themeId, density, glass, motion, color-scheme, and quick-reply settings.
  - `scripts/check-css-scope.mjs` — CSS selector scoping contract.
  - `test/unit/portal-css.test.ts` and `test/unit/adapters.test.ts` — regression expectations for theme assets, scoping, header preservation, portal/forum parity, and semantic hooks.

This document is the design contract for future Liquid Glass UI work. If implementation requires a visual decision not covered here, either extend this file or add an open question before introducing a new pattern.

## Brand

- Personality:
  - Modern, premium, minimal, technical, calm.
  - “Liquid Glass” rather than legacy forum chrome: translucent surfaces, optical depth, light refraction, subtle motion.
  - Forum utility remains central; the reskin should make dense information easier to scan, not hide it behind decoration.
- Trust signals:
  - Preserve original Chiphell links, forms, inline handlers, and business-critical Discuz nodes.
  - Improve hierarchy through semantic class hooks and CSS, not by replacing server-rendered content.
  - Keep navigation, search, thread/post actions, and account controls recognizable.
- Avoid:
  - Heavy red legacy forum blocks or high-saturation warning-like accents unless content semantics require them.
  - Flat gray container stacks where every Discuz wrapper gets its own panel.
  - Replacing form/link nodes that may carry Discuz behavior.
  - Unscoped CSS selectors.
  - Animation that depends on motion being enabled.

## Product goals

- Goals:
  - Provide a consistent Liquid Glass UI system across Chiphell pages.
  - Make legacy Discuz layouts feel modern while preserving original function.
  - Improve scanability of forum sections, threads, portal news, and account/search areas.
  - Keep future page refactors small, reversible, and driven by reusable route/component rules.
- Non-goals:
  - Do not redesign Chiphell as a separate web app.
  - Do not fetch remote code or add tracking.
  - Do not capture cookies, forms, or private data.
  - Do not introduce a separate design-system dependency unless explicitly approved.
- Success signals:
  - New route CSS follows the same scoped selector pattern and passes `npm run lint:css`.
  - Existing Discuz interactions still work after visual changes.
  - Cards, headers, lists, controls, and responsive behavior match the Liquid Glass grammar below.
  - Dense forum content remains readable at desktop and mobile widths.

## Personas and jobs

- Primary personas:
  - Logged-out readers browsing portal news, articles, and forum indexes.
  - Logged-in community members reading threads, replying, posting, navigating boards, and managing account links.
  - Power users who rely on quick navigation, search, pagination, and compact high-density lists.
- User jobs:
  - Find the right forum board quickly.
  - Scan thread titles, authors, reply/view counts, and sticky/normal states.
  - Read long posts/articles with comfortable typography.
  - Search and jump across forum areas without losing original behavior.
  - Compose or reply without visual noise breaking focus.
- Key contexts of use:
  - Desktop browsing with hover states available.
  - Narrow desktop/tablet where header and promo grids must collapse gracefully.
  - Mobile widths where multi-column forum and promo grids become single column.
  - System dark mode and reduced-motion environments.

## Information architecture

- Primary navigation:
  - Global Chiphell header shell contains top links, brand/account rail, navigation rail, quick menu, and search.
  - Active navigation is synchronized from current URL and marked with `data-chh-lg-active` / `aria-current="page"`.
  - Hover navigation uses a moving pill under nav items; text changes are subtle and the item itself stays transparent.
- Core routes/screens:
  - `portal-home`: hero/promo, carousel, announcements, news rows, stats strip, portal sections.
  - `portal-list`: category header/subcategory chips, article-card stream, pagination, related-category sidebar.
  - `forum-index`: forum section headers and board-card grid.
  - `thread-list`: toolbar, thread type filters, card-like thread rows, pagination, quick reply.
  - `thread-detail`: post cards with author rail, content body, metadata/actions, quick reply.
  - `article-view`: article shell, header, body, comments.
  - `profile`: profile header, card, fields, posts.
  - `compose`: compose form, editor toolbar, editor field, submit actions.
- Content hierarchy:
  - Page chrome first: header/search/nav.
  - Route context second: breadcrumb / announcement / stats / toolbar.
  - Primary content third: board cards, threads, posts, articles.
  - Secondary actions last: pagination, footer, floating action rail.

## Design principles

- Principle 1: Preserve function, restyle structure.
  - Add `omchh-*` classes and `data-*` attributes to existing DOM.
  - Move or wrap nodes only when needed for layout, and preserve original nodes/events.
- Principle 2: Outer wrappers become transparent; real content becomes designed surfaces.
  - Reset legacy Discuz wrappers (`background`, `border`, `box-shadow`) when they only create noise.
  - Apply glass treatment to the meaningful card, section, toolbar, or row.
- Principle 3: Depth comes from layered light, not heavy borders.
  - Use translucent gradients, 1px inner highlights, radial accent glows, and soft shadows.
- Principle 4: Dense data remains compact and scannable.
  - Use small type, tabular numerals, chips, and grid/flex rewrites to make forum content readable.
- Principle 5: Motion is supportive and optional.
  - Hover lifts and sliding pills should be subtle.
  - Reduced motion must disable or shorten movement.
- Principle 6: Media defines height; text columns adapt to it — never the reverse.
  - When two side-by-side cards must bottom-align and one contains a fixed-ratio image/carousel, the image is the height anchor. Lock the media to its native aspect ratio (e.g. the portal `热门` banner is `600 / 252`) so it is never stretched or compressed.
  - Make the text/list column adapt to the media column's height instead of forcing the media to grow. If the text column is intrinsically taller, remove it from grid track sizing (`position: absolute` on its outer wrapper so it contributes 0 height), let the media column set the track, then `align-items: stretch` pulls the text card to that height and its rows (`flex: 1`) redistribute to fill.
  - Prefer this over a hard-coded pixel band height. A `height: 380px` magic number was previously used and caused the banner to scale a 252px-tall image up ~1.5× (visible "compression/distortion"); the ratio-anchored approach removed both the magic number and the distortion.
- Tradeoffs:
  - `!important` is acceptable when overriding Discuz inline/legacy CSS, but new rules should still be scoped and intentional.
  - Route-specific overrides are acceptable for sample parity, but should converge toward reusable component patterns.

## Visual language

### Color

- Base background:
  - Light mode uses near-white cold OKLCH background plus blue/cyan radial glows.
  - Dark mode uses deep blue-gray gradients and preserves the same accent family.
- Core tokens:
  - `--bg: oklch(99% 0.002 240)`
  - `--fg: oklch(18% 0.012 250)`
  - `--muted: oklch(54% 0.012 250)`
  - `--accent: oklch(58% 0.18 255)`
- Accent usage:
  - Use accent as glow, left rail, small dot, hover wash, focus halo, or active chip.
  - Avoid large saturated blocks except for selected micro-states.
- Neutral usage:
  - Use white with alpha for glass, highlights, and borders.
  - Use muted gray-blue for metadata.

### Typography

- Font stacks:
  - Display: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`
  - Body: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`
  - Mono: `'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace`
- Common sizes:
  - Navigation/buttons/chips: `12px` to `13px`
  - Card titles: `14px` to `15px`
  - Body/post/article text: `15px`
  - Brand title: `clamp(28px, 4vw, 44px)`
- Common weights:
  - Metadata: normal to `650`
  - Controls/card titles: `650` to `760`
  - Section titles: `750` to `880`
- Readability:
  - Post body line-height: about `1.75`.
  - Article body line-height: about `1.78`.
  - Numeric forum stats should use `font-variant-numeric: tabular-nums`.

### Spacing/layout rhythm

- Global content width: `min(1240px, calc(100vw - 32px))`.
- Header margin: roughly `10px auto 16px`.
- Common section/card gaps:
  - Tight controls: `6px` to `8px`
  - Card grids: `12px` to `16px`
  - Section separation: `18px` to `24px`
- Common padding:
  - Chips: horizontal `8px` to `12px`
  - Compact rows: `8px` to `13px`
  - Cards: `12px` to `18px`
  - Posts/articles: `18px` to `22px`

### Shape/radius/elevation

- Radius scale:
  - `--chh-lg-radius-md: 14px`
  - `--chh-lg-radius-lg: 18px`
  - `--chh-lg-radius-xl: 24px`
  - Header shell: `34px`
  - Pills/chips/buttons: `999px`
- Elevation:
  - Soft card: `var(--chh-lg-shadow-soft)`.
  - Header/menus: `var(--chh-lg-shadow)` or stronger custom shadows.
  - Hover lift: stronger border + stronger shadow + `translateY(-1px/-2px)`.
- Glass material:
  - Standard card blur: `blur(22px~24px) saturate(1.55~1.7)`.
  - Strong header/menu blur: `blur(28px~34px) saturate(1.8~1.85)`.
  - Small overlay blur: `blur(12px~14px) saturate(1.3~1.45)`.

### Motion

- Default motion token: `180ms cubic-bezier(.2, .8, .2, 1)`.
- Hover:
  - Buttons/cards typically lift `translateY(-1px)`.
  - Larger promo/forum cards may lift `translateY(-2px)`.
- Active:
  - Controls settle with `translateY(0) scale(0.985)`.
- Nav:
  - Hover pill moves through `left`, `width`, and `opacity` transitions.
- Reduced motion:
  - Transition and animation durations must collapse to near-zero.
  - Transform-based hover movement should be disabled or minimized.

### Imagery/iconography

- Images:
  - Use `object-fit: cover` in carousels and banner areas.
  - Apply very subtle `saturate` / `contrast` / `brightness` adjustments only.
  - Carousels/banners must keep their native aspect ratio. The portal `热门` banner is locked to `600 / 252` (≈ `252px` tall at the column width); never let a layout requirement stretch or up-scale a banner to fill a taller card. See Principle 6 for the equal-height strategy.
- Icons:
  - Prefer original icons/assets when present.
  - Place icons in glass tiles when they are part of card grids.
  - Use small generated CSS indicators for search, arrows, dots, and section bullets.

## Components

### Existing components to reuse

- Global shell:
  - `#chh-lg-header`
  - `.chh-lg-header-glass`
  - `.chh-lg-top-rail`
  - `.chh-lg-brand-rail`
  - `.chh-lg-nav-rail`
- Common semantic hooks:
  - `.omchh-page`
  - `.omchh-content`
  - `.omchh-footer`
  - `.omchh-block`
  - `.omchh-module`
  - `.omchh-pagination`
- Route hooks:
  - `.omchh-portal-home`
  - `.omchh-portal-list-route`
  - `.omchh-portal-list-card`
  - `.omchh-portal-list-sidebar`
  - `.omchh-forum-index`
  - `.omchh-thread-list-route`
  - `.omchh-thread-detail`
  - `.omchh-article-view`
  - `.omchh-profile`
  - `.omchh-settings` (spacecp control panel) + `.omchh-settings-card` / `.omchh-settings-section` / `.omchh-settings-section-title`
  - `.omchh-messages` (private/public PM + notices) + `.omchh-messages-card` / `.omchh-messages-tabs` / `.omchh-messages-list` / `.omchh-messages-row` / `.omchh-messages-actions` / `.omchh-messages-toolbar`
  - `.omchh-side-nav` (shared spacecp sidebar nav for settings + messages)
  - `.omchh-compose`

### New/changed components

When adding another page, create route-specific semantic hooks that follow the existing pattern:

- Page wrapper: `.omchh-{route}` or `.omchh-{route}-route`.
- Main surface: `.omchh-{feature}`.
- Card/list item: `.omchh-{feature}-card` or `.omchh-{feature}-row`.
- Title: `.omchh-{feature}-title`.
- Metadata: `.omchh-{feature}-meta`.
- Actions: `.omchh-{feature}-actions`.

Do not add a new UI framework or class naming system unless the existing hooks cannot express the page.

Thread-list pages that also contain Discuz subforum tables should use the dedicated forumdisplay hooks:

- Subforum section: `.omchh-subforum-section`.
- Subforum table/card row: `.omchh-subforum-table`, `.omchh-subforum-row`.
- Subforum fields: `.omchh-subforum-icon`, `.omchh-subforum-title`, `.omchh-subforum-stats`, `.omchh-subforum-lastpost`.
- Thread special rows: `.omchh-thread-notice-row`, `.omchh-thread-separator`, `.omchh-thread-lastpost`.

These hooks intentionally separate forumdisplay subforum tables from forum-index board cards so the forum-index `.fl_tb` grid rules do not hide non-`.fl_g` Discuz table cells.

### Portal hero band — `快讯` (news) + `热门` (hot carousel)

Two-column band at the top of `portal-home` (`.chip_topmain` → `.cright` = `快讯` / `#portal_block_673`, `.cleft` = `热门` / `.chiphell_home` with `#home-banner`).

- Layout: CSS grid `minmax(0, 585fr) minmax(0, 600fr)`, page-rail aligned, single column below `760px`.
- Equal-height contract (desktop only, `@media (min-width: 761px)`): the two cards bottom-align without distorting the banner. The `快讯` card is `position: absolute` inside its column so it contributes 0 to the grid track; `热门` (image locked `600 / 252`) sets the track height; `align-items: stretch` pulls `快讯` to that height; the 12 news rows use `flex: 1 1 0` to fill. Title text vertically centers via `li { display: flex; align-items: center }` while the `<a>` stays `display: block` for ellipsis. (See Principle 6.)
- `快讯` rows are intentionally de-stacked (see "De-stacked list rows" below).

### De-stacked list rows

For dense vertical link lists (e.g. `快讯`), do NOT give every row its own glass pill — stacked per-row borders/gradients/inset bars/shadows read as visual noise ("background stacking"). Instead:

- Rows are transparent (`border: 0; background: transparent; box-shadow: none; backdrop-filter: none`); separation comes from rhythm, not chrome.
- Leading index numbers come from a CSS counter (the source DOM has no index node): `counter-reset` on the `ul`, `counter-increment` on the `li`, rendered via `li a::before { content: counter(...) }`. The first three are accent-highlighted.
- Hover is a single layer: `color-mix(in oklch, var(--accent) 9%, transparent)` wash + `inset 3px 0 0 var(--accent)` left bar + accent text. No second white fill, no multi-shadow.
- Keep the parent card's `::before` accent glow low (≈ `0.3` opacity) so it does not muddy the list behind it.

### Variants and states

- Glass card:
  - Default: translucent background, 1px white border, soft shadow, inner highlight.
  - Hover/focus-within: brighter border, larger shadow, `translateY(-1px/-2px)`.
- Section header:
  - Left glow dot.
  - Optional trailing gradient line.
  - 14px–15px bold display text.
- Chip/button:
  - Inline-flex center alignment.
  - 28px–40px height depending context.
  - 999px radius.
  - White-alpha glass background.
- Data/stat chip:
  - 22px–24px height.
  - Tabular numerals.
  - Muted text unless selected/active.
- Sticky/highlighted rows:
  - Use accent wash or radial glow, not heavy fill.

### Token/component ownership

- Theme-level visual tokens live in `src/theming/themes/liquid-glass/routes.css` until a broader token extraction is required.
- Theme metadata lives in `src/theming/themes/liquid-glass/theme.json`.
- Theme-agnostic DOM classification belongs in `src/foundation/semantics/*`; Liquid Glass-only DOM rendering belongs in `src/theming/themes/liquid-glass/adapter/*`.
- Route detection belongs in `src/foundation/route.ts`.
- CSS scope enforcement belongs to `scripts/check-css-scope.mjs`.

## Accessibility

- Target standard:
  - Practical WCAG-aligned readability and keyboard access for an extension reskin over legacy Discuz markup.
- Keyboard/focus behavior:
  - All links, buttons, inputs, selects, and `[tabindex]` need visible focus.
  - Current focus pattern: 2px accent outline plus 5px soft accent halo.
  - Do not remove `href`, form action, inline event handlers, or submit behavior from original nodes.
- Contrast/readability:
  - Use `--chh-lg-ink` for primary text and `--chh-lg-muted` for secondary text.
  - Avoid placing small muted text over busy images.
  - Image titles must use dark/blurred backing or gradient overlay.
- Screen-reader semantics:
  - Prefer preserving server-rendered semantic nodes.
  - Add ARIA only for newly created controls, such as carousel previous/next buttons and action rail labels.
  - Decorative collapse icons or slider dots can be marked hidden when they are replaced visually.
- Reduced motion and sensory considerations:
  - Respect `prefers-reduced-motion` and the settings motion attribute.
  - Avoid mandatory shimmer, parallax, or continuous animation.

## Responsive behavior

- Supported breakpoints/devices:
  - Desktop: full 1240px shell, multi-column grids.
  - `<=1060px`: forum board grid reduces from 3 columns to 2.
  - `<=980px`: header/account/search stacks; portal promo becomes single column.
  - `<=760px`: breadcrumb/announcement/stats split into vertical layout.
  - `<=680px`: forum board grid becomes single column.
  - `<=640px`: header glass radius and brand/account/search details compact.
  - `<=560px`: promo card and carousel height/radius tighten.
- Layout adaptations:
  - Convert table/float layouts to grid/flex visually.
  - Collapse nonessential rail or account detail when narrow.
  - Preserve horizontal scanability for nav where possible; otherwise reduce padding and hide overflow safely.
- Touch/hover differences:
  - Hover-only affordances must not hide essential actions.
  - On touch widths, actions should remain visible or accessible without hover.

## Interaction states

- Loading:
  - Preserve existing Discuz loading behavior.
  - If adding custom loading UI, use a glass panel with muted text and no continuous motion unless reduced-motion-safe.
- Empty:
  - Use a soft glass card with muted explanatory copy and one clear action if available.
- Error:
  - Keep original error semantics/forms.
  - Use restrained accent/warning treatment; do not introduce aggressive red panels unless the content itself is an error.
- Success:
  - Use small chips, badges, or inline accent wash rather than large banners.
- Disabled:
  - Lower opacity, remove transform hover, keep layout dimensions stable.
- Offline/slow network:
  - Not currently a first-class extension state. If introduced, show compact nonblocking status inside existing chrome.

## Content voice

- Tone:
  - Clear, technical, concise, premium but not decorative.
- Terminology:
  - Keep Chiphell and Discuz terms recognizable: 社区, 快捷导航, 搜索, 快讯, 热门, 评测, 论坛, 回复, 发帖.
  - Avoid inventing new labels where the original site already has established wording.
- Microcopy rules:
  - Short labels fit in 28px–40px controls.
  - Use title attributes or preserved text for truncated content where available.
  - Do not hide important text purely for visual neatness unless an accessible equivalent remains.

## Implementation constraints

- Framework/styling system:
  - Manifest V3 browser extension.
  - TypeScript content scripts.
  - Theme CSS under `src/theming/themes/liquid-glass`.
  - No remote code.
- Design-token constraints:
  - Use existing OKLCH/color-mix token style.
  - Keep selectors under `html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"]`.
  - Prefer extending `--chh-lg-*` tokens rather than one-off raw values when a value is reused.
- Performance constraints:
  - Avoid layout thrash in pointer/scroll listeners; current pointer state is scheduled through `requestAnimationFrame`.
  - Avoid replacing large DOM subtrees.
  - Keep expensive blur surfaces bounded to meaningful panels.
- Compatibility constraints:
  - Host-limited to `https://www.chiphell.com/*`.
  - Preserve original Discuz links, forms, quick-menu handlers, search forms, and account links.
  - Menus may need root-layer relocation to avoid clipping.
  - Dark mode and reduced motion must remain supported.
- Test/screenshot expectations:
  - Minimum validation for style-only work: `npm run lint:css`.
  - Standard validation after adapter/theme changes: `npm run verify`.
  - Add/update unit tests when introducing route hooks, DOM restructuring, or CSS parity assumptions.
  - Manual QA targets from `README.md` remain the baseline route list.

## Page refactor checklist

Use this checklist when adding or refreshing another page:

1. Identify the route in `src/foundation/route.ts` or add a new route if needed.
2. Add semantic hooks in `src/foundation/semantics/*`; do not replace business-critical nodes.
3. Mark page, primary surface, rows/cards, title, metadata, actions, and pagination.
4. Use the shared page width: `min(1240px, calc(100vw - 32px))`.
5. Make legacy outer wrappers transparent when they are only structural.
6. Apply Liquid Glass only to meaningful surfaces.
7. Use section headers with glow dot and optional trailing gradient line.
8. Convert dense table/float layouts to grid/flex visually while preserving DOM.
9. Add hover, focus-visible, active, dark-mode, and reduced-motion states.
10. Check mobile breakpoints for at least desktop, `<=980px`, and one phone breakpoint.
11. Run `npm run lint:css`; run `npm run verify` for adapter or route changes.
12. Update this `DESIGN.md` if a new reusable pattern is created.

## Reference CSS recipes

### Standard Liquid Glass card

```css
/* Scope selector omitted here for readability; real rules must be fully scoped. */
.my-card {
  position: relative;
  overflow: hidden;
  border: 1px solid oklch(100% 0 0 / 0.52);
  border-radius: var(--chh-lg-radius-lg);
  background:
    linear-gradient(145deg, oklch(100% 0 0 / 0.58), oklch(100% 0 0 / 0.28)),
    radial-gradient(circle at 0 0, color-mix(in oklch, var(--accent) 12%, transparent), transparent 20rem);
  box-shadow: var(--chh-lg-shadow-soft);
  backdrop-filter: blur(24px) saturate(1.65);
  -webkit-backdrop-filter: blur(24px) saturate(1.65);
}
```

### Compact glass chip/button

```css
.my-chip {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  padding: 0 11px;
  border: 1px solid oklch(100% 0 0 / 0.42);
  border-radius: 999px;
  color: var(--chh-lg-ink);
  background: oklch(100% 0 0 / 0.32);
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.62);
}
```

### Section title pattern

```css
.my-section-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
}

.my-section-title::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow:
    0 0 0 4px color-mix(in oklch, var(--accent) 14%, transparent),
    0 0 20px color-mix(in oklch, var(--accent) 36%, transparent);
}
```

### De-stacked counter list (e.g. `快讯`)

```css
.my-list ul { counter-reset: row; }
.my-list li { counter-increment: row; }
.my-list li a {
  position: relative;
  display: block;            /* keep block for text-overflow:ellipsis */
  padding: 0 12px 0 32px;    /* left room for the index */
  border: 0;
  background: transparent;
  box-shadow: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.my-list li a::before {
  content: counter(row);
  position: absolute;
  left: 6px; top: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center;
  width: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--chh-lg-muted);
  opacity: 0.5;
}
.my-list li:nth-child(-n + 3) a::before { color: var(--accent); opacity: 1; }
.my-list li a:hover {
  background: color-mix(in oklch, var(--accent) 9%, transparent);
  box-shadow: inset 3px 0 0 var(--accent);   /* single layer, not a stack */
  color: var(--accent);
}
```

### Media-anchored equal-height band

```css
/* Right column holds a fixed-ratio banner; left column (text/list) matches its height. */
@media (min-width: 761px) {
  .band { display: grid; grid-template-columns: minmax(0,585fr) minmax(0,600fr); align-items: stretch; }

  /* Text column contributes 0 to the grid track so the media column sets the height. */
  .band .text-col { position: relative; min-height: 0; }
  .band .text-col > .card-wrap { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; }

  /* Banner keeps native ratio — never stretched. */
  .band .media .banner { aspect-ratio: 600 / 252; }      /* or height: 252px */

  /* Rows redistribute to fill whatever height the media set. */
  .band .text-col .list { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .band .text-col .list li { flex: 1 1 0; min-height: 0; display: flex; align-items: center; }
}
```

## Open questions

- [ ] Should `routes.css` eventually be split by route/component after the current sample parity layers stabilize? Owner: maintainer. Impact: maintainability and override order.
- [ ] Should frequently repeated glass values be moved from `routes.css` into a richer token file? Owner: maintainer. Impact: consistency and easier future refactors.
- [ ] What is the formal minimum browser support target beyond current Chrome/Edge MV3 behavior? Owner: maintainer. Impact: CSS feature usage such as OKLCH, color-mix, and backdrop-filter.
- [ ] Should visual regression screenshots be added for the main README QA routes? Owner: maintainer. Impact: safer visual refactors.
- [ ] The portal hero band relies on `position: absolute` over the `快讯` wrapper chain to drop it from grid track sizing. It depends on the current Discuz nesting (`.cright > .chiphell_box > … > #portal_block_673`). If Chiphell changes that markup the band may need re-anchoring. Owner: maintainer. Impact: equal-height robustness. Consider whether `subgrid` or a container-query approach is cleaner once browser support is confirmed.
- [ ] With 12 news rows compressed into the banner height, rows land at ≈ `23px` each. If `快讯` row count grows, revisit min row height vs. truncating the list. Owner: maintainer. Impact: `快讯` readability.
