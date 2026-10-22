# Privacy

`oh-my-chh` offers two local skins for Chiphell: the original site, or an Excel-style disguise.

- The extension only runs on `https://www.chiphell.com/*`.
- The extension asks only for the `storage` permission.
- The chosen skin and the debug-log switch are stored in `chrome.storage.sync`.
- The extension does not send browsing data, post content, form content, cookies, or usernames to any external service.
- The extension does not inject remote executable code.

## Local debug log

When the debug log is switched on (popup → 高级), the extension stores error summaries in `chrome.storage.local` for local diagnostics only. Logs are not uploaded, not synced, and can be exported or cleared from the popup. Exported JSON is capped at 5 MiB and does not intentionally include page body text, account data, cookies, or form content.

## Excel disguise skin

- The imported `.xlsx` workbook is parsed locally and stored only in `chrome.storage.local` on this device. It is never uploaded or synced, and it can be removed on the extension's workbook import page.
- The workbook is rendered only inside the extension's own page (an extension-origin iframe), so Chiphell page scripts cannot read its contents.
- The browser tab title shows the display file name you configure; that title is visible to the Chiphell web page.
- Forum pages are fetched from `https://www.chiphell.com` with your existing session, the same requests your browser would make when you browse normally.
- Replies are sent only when you press the post button, only to `https://www.chiphell.com`, with your existing session, as the same forms Chiphell's own reply boxes submit. Unsent drafts stay in the page's memory and are discarded when the tab closes.
