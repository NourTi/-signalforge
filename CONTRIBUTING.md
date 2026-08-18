# Contributing to SignalForge

SignalForge has two publishable layers in this repository: a static GitHub Pages marketing site at repository root and a sanitized full-stack application source package in [`signalforge-fullstack-source.zip`](./signalforge-fullstack-source.zip).

## Where to contribute

| Area | Location | Contribution focus |
| --- | --- | --- |
| Public website | `index.html`, brand files, metadata | Positioning, accessibility, responsive presentation, links, and GitHub Pages compatibility. |
| Visible application source | `app/` | TypeScript schema, package configuration, and future selected product modules for public code review. |
| Full source distribution | `signalforge-fullstack-source.zip` | React client, TypeScript server, MySQL/Drizzle data model, tests, and product documentation. |

## Contribution standards

Keep changes focused, tested, and explainable. For marketing-site changes, verify desktop/mobile layout, keyboard navigation, contrast, working links, and the private-beta contact route. For application changes, run the relevant TypeScript and Vitest checks in the extracted source package before updating the distribution archive.

Never publish real secrets, private deployment URLs, customer information, database exports, SMTP passwords, authentication credentials, Telegram bot tokens, or unscoped API keys. Use placeholder values and document configuration requirements instead.

The GitHub Pages site is a public static surface; it is not the full application runtime. Review [PUBLISHING.md](./PUBLISHING.md) before changing deployment-related files.
