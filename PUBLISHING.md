# Publishing and Source Distribution

## Two deliberately separate deployment layers

| Layer | Repository location | Purpose | Runtime |
| --- | --- | --- | --- |
| Public marketing site | Repository root | Brand, product story, private-beta route, and social metadata | GitHub Pages |
| Full SignalForge application | [`signalforge-fullstack-source.zip`](./signalforge-fullstack-source.zip) | React client, TypeScript server, tRPC API, Drizzle/MySQL schema, tests, SMTP, discovery, encryption, and compliance logic | Node.js server plus MySQL-compatible database |

The public landing site is live at [nourti.github.io/-signalforge](https://nourti.github.io/-signalforge/). It publishes from the `main` branch and repository root.

## Important hosting boundary

GitHub Pages serves static files only. It does **not** run a Node.js server, database, encrypted SMTP credentials, public-business discovery service, user authentication, or protected environment variables. The full SignalForge application source is published for inspection and deployment, but must run on a server-side platform.

## Source access

The complete sanitized source export is available as [signalforge-fullstack-source.zip](./signalforge-fullstack-source.zip). It excludes real credentials, database URLs, SMTP passwords, API tokens, local environment files, logs, and customer data. Directly browseable TypeScript includes the [MySQL schema](./app/drizzle/schema.ts) and the application [package configuration](./app/package.json).

## Deploying the full application

Download and extract the source package, use Node.js 22+ and pnpm 10+, configure a MySQL-compatible database, and supply the required environment values through your deployment platform’s encrypted secret manager. The source package documents the platform adapter boundaries for authentication, storage, maps, LLM access, and notifications.

For a branded public address, configure a custom domain in GitHub Pages settings and add the matching DNS records with your domain provider.
