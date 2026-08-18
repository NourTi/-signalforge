# Security Policy

Do not report security issues through public GitHub issues.

For responsible disclosure, email [rafaraf201@gmail.com](mailto:rafaraf201@gmail.com) with the subject line `SignalForge security report`. Do not include customer data, credentials, exploit code, or active attack details in a public report.

## Repository and source boundary

This repository contains a public GitHub Pages marketing site, directly browseable selected source files, and a sanitized full-stack application archive: [`signalforge-fullstack-source.zip`](./signalforge-fullstack-source.zip). The archive includes product code for the React client, TypeScript server, schema, tests, encryption helpers, email workflow, discovery, and compliance controls. It contains **no** production credentials, customer data, database connection strings, SMTP passwords, or private environment files.

GitHub Pages does not deploy the application server, database, user authentication, encrypted SMTP delivery, or discovery service. Those must be operated on a server-side deployment with an encrypted secret manager.

## Secret-handling rules

Never commit real API keys, SMTP passwords, Telegram tokens, database URLs, session secrets, customer exports, or private deployment URLs. If a secret is exposed, revoke or rotate it immediately, remove it from version history where possible, and report the incident privately using the contact above.

For architecture and deployment context, see [PUBLISHING.md](./PUBLISHING.md).
