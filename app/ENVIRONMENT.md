# Environment Configuration

Create a private local `.env` file or use your deployment platform’s secret manager. **Never commit real values.**

| Variable | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | MySQL-compatible database connection | Yes |
| `JWT_SECRET` | Session signing and AES-256-GCM application-secret derivation | Yes |
| `APP_URL` | Public application URL used by signed unsubscribe links | Production |
| `VITE_APP_ID` | OAuth application identifier for the default authentication adapter | Adapter-specific |
| `OAUTH_SERVER_URL` | OAuth service URL for the default authentication adapter | Adapter-specific |
| `BUILT_IN_FORGE_API_URL` | Original platform service adapter endpoint | Adapter-specific |
| `BUILT_IN_FORGE_API_KEY` | Original platform service adapter credential | Adapter-specific |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend provider-adapter endpoint | Adapter-specific |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend provider-adapter credential | Adapter-specific |

The following are per-user application settings encrypted at rest and must **not** be supplied through this file or committed to source control: SMTP passwords, Telegram bot tokens, and Reply Hub signing secrets.

For the optional Cloudflare Reply Hub worker, configure its `SIGNALFORGE_*` worker secrets through Wrangler/Cloudflare, as described in `docs/reply_hub_cloudflare.md`. Do not put those values in `wrangler.toml`.
