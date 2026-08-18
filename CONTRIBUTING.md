# Contributing to SignalForge

SignalForge is an open-source full-stack application. Contributions are welcome across the public GitHub Pages site at repository root and the directly browsable product source under [`app/`](./app/).

## Choose the right area

| Area | Location | Examples |
| --- | --- | --- |
| Public presence | Repository root | Product narrative, static landing page, SEO, visual assets, Pages accessibility. |
| Product frontend | `app/client/` | React pages, dashboard interactions, keyboard accessibility, responsive states. |
| Product backend | `app/server/` | tRPC procedures, lead workflows, discovery, encryption, Reply Hub, SMTP safeguards. |
| Data model | `app/drizzle/` | Schema changes, reviewed SQL migrations, relations, data integrity. |
| Inbound worker | `app/cloudflare-reply-hub/` | Cloudflare Email Routing payload normalization and signature forwarding. |
| Tests and docs | `app/server/*.test.ts`, `app/docs/` | Regression coverage, setup guidance, architecture and operations notes. |

## Local workflow

Use Node.js 22+, pnpm 10+, and a MySQL-compatible development database for data-backed work.

```bash
git clone https://github.com/NourTi/-signalforge.git
cd -signalforge/app
pnpm install
pnpm test
pnpm check
pnpm dev
```

Read [`app/ENVIRONMENT.md`](./app/ENVIRONMENT.md) before creating a private environment file. Never commit real credentials, customer data, database URLs, SMTP passwords, OAuth values, provider tokens, encrypted-secret blobs, or Reply Hub signing secrets.

## Quality requirements

Keep changes scoped and explain the user impact in the pull request. Update or add Vitest coverage for backend behaviour, especially any change to user isolation, lead ownership, sending controls, suppression, opt-out handling, secret handling, or inbound webhook validation. Run `pnpm test` and `pnpm check` before opening a pull request.

For database work, update `app/drizzle/schema.ts`, generate the migration, inspect the SQL for data loss or unsafe operations, and document any rollout impact. Do not bypass approval gates or create an automatic send/reply mechanism.

## Pull requests

Use a descriptive title, explain the motivation and verification performed, and include screenshots for visible interface work. A contribution should preserve SignalForge’s core product rule:

> A person remains in control of every outbound message. Drafting, approval, confirmation, suppression, opt-out, sender-readiness, and reply handling must remain explicit and auditable.

## Security reports

Do not open a public issue for a suspected vulnerability. Follow the responsible disclosure process in [SECURITY.md](./SECURITY.md).
