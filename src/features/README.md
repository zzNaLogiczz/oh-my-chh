# Features Context

This context is intentionally empty until the first real feature needs data, UI, or a local interface.

Entry rules:

1. Do not add repositories, storage ports, background messaging, or service worker code without a concrete feature consumer.
2. A feature may depend on Foundation semantic hooks, Preferences configuration, and Platform scope/lifecycle ports.
3. Popup-facing feature metadata must be separated from implementation before popup imports it.
4. Every feature side effect must be reversible through the platform enhancement scope or a feature-owned teardown path.
