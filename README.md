# oh-my-chh

Manifest V3 Chrome/Edge extension for `https://www.chiphell.com/*` with two skins, picked in the toolbar popup:

- **原版** — the extension leaves Chiphell untouched.
- **Excel 伪装** — opening Chiphell shows an Excel-style window instead: forum index, channel/sub-channel navigation, thread lists, thread details (posts in a comments pane, with text replies to the thread or to a single floor), portal articles and search, with back / up / paging controls. A boss key switches instantly to a workbook you import.

## Scope

- Host-limited content script: `https://www.chiphell.com/*` only; `storage` is the only permission.
- No remote code, no tracking, no cookie/form capture. See `PRIVACY.md`.
- The Excel skin renders inside an extension-origin iframe; the imported workbook never leaves `chrome.storage.local`.

## Development

```bash
npm install
npm run verify
```

Build output lands in `dist/`. Load `dist/` as an unpacked extension in Chrome or Microsoft Edge.

## Layout

- `src/platform/bootstrap.ts` — content script: reads the skin, hands the page to the Excel host when needed.
- `src/preferences/popup/` — toolbar popup (skin picker + the selected skin's settings).
- `src/remake/excel/` — Excel skin: `host/` (content-script side), `app/` (iframe app), `parse/` (Discuz page parsers), `options/` (workbook import page), `workbook/` (xlsx normalization and storage).
