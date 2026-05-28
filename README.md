# oh-my-chh

Manifest V3 Chrome/Edge extension prototype for reskinning `https://www.chiphell.com/*` with the Liquid Glass theme.

## Scope

- Host-limited content script: `https://www.chiphell.com/*` only.
- No remote code, no tracking, no cookie/form capture.
- Current theme: `liquid-glass` (`Liquid Glass`). Previous visual directions are removed, and old stored theme IDs are normalized to the new theme.
- DOM adapters add semantic `omchh-*` classes and data attributes to existing Discuz nodes instead of replacing business-critical form/link nodes.

## Development

```bash
npm install
npm run verify
```

Build output lands in `dist/`. Load `dist/` as an unpacked extension in Chrome or Microsoft Edge.

## Manual QA targets

- `https://www.chiphell.com/portal.php`
- `https://www.chiphell.com/forum.php`
- `https://www.chiphell.com/forum-146-1.html`
- `https://www.chiphell.com/article-34976-1.html`
- `https://www.chiphell.com/space-uid-2.html`

Logged-in-only pages such as thread detail and compose require manual fixture/export validation in a logged-in browser.
