# Privacy

`oh-my-chh` is a local visual reskin for Chiphell.

- The extension only runs on `https://www.chiphell.com/*`.
- The extension asks only for the `storage` permission.
- User theme preferences are stored in `chrome.storage.sync`.
- Selector health diagnostics are stored locally in `chrome.storage.local`.
- The extension does not send browsing data, post content, form content, cookies, or usernames to any external service.
- The extension does not inject remote executable code.

## Local performance monitoring logs

The extension stores refresh timing, trigger source, route, and error summaries in `chrome.storage.local` for local diagnostics only. Logs are not uploaded, not synced, and can be exported or cleared from the popup. Exported JSON is capped at 5 MiB and does not intentionally include page body text, account data, cookies, or form content.
