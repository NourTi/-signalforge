# Publishing and Source Distribution

SignalForge has two public layers in this repository.

| Layer | Location | Purpose |
| --- | --- | --- |
| Marketing site | Repository root | Static GitHub Pages site published at `https://nourti.github.io/-signalforge/`. |
| Open-source application | [`app/`](./app/) | Directly browsable React client, Node/Express/tRPC server, MySQL/Drizzle schema, tests, worker source, and setup documentation. |

GitHub Pages publishes the root static site from `main`. It does **not** execute the full application: server-side workflows require a Node runtime, a MySQL-compatible database, and a private secret manager.

## Publishing the marketing site

Enable GitHub Pages from the repository `main` branch and root directory. A custom domain can be added through GitHub Pages settings and your domain DNS provider.

## Publishing the application

The application is intentionally open source and directly inspectable under `app/`. To run it, follow [`app/README.md`](./app/README.md), configure the private values described in [`app/ENVIRONMENT.md`](./app/ENVIRONMENT.md), connect provider adapters under `app/server/_core/`, apply reviewed database migrations, and deploy the Node.js server to a platform you control.

Never publish real database URLs, SMTP passwords, OAuth credentials, API tokens, user data, encrypted-secret blobs, or Reply Hub signing secrets. The repository’s `app/.gitignore` and source review process are designed to keep those values out of Git.
