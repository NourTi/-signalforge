# SignalForge Reply Hub — Cloudflare Email Routing Setup

## What this connection does

The Reply Hub is an **inbound-only** route. Cloudflare receives mail addressed to an inbox you own, verifies it reaches the configured Email Routing Worker, and the Worker signs a small normalized payload for SignalForge. SignalForge then links the event to the matching lead, classifies it, and stores a private response draft if you choose to write one.

> It does not enable automatic replies, bulk sends, rotating sender addresses, or public temporary mailboxes.

Cloudflare documents Email Routing Workers and supports local testing with `wrangler dev`; its official inbound Worker examples parse raw RFC 5322 mail and route messages by address. [1]

## Prerequisites

| You need | Why |
| --- | --- |
| A domain you own and manage in Cloudflare | Cloudflare Email Routing must be enabled for the reply address. |
| A dedicated inbox address, for example `replies@yourdomain.com` | This is the stable, accountable reply lane for your outreach. |
| The Reply Hub signing secret shown once in SignalForge | It allows the worker to authenticate inbound payloads. |
| The deployed SignalForge endpoint | Use `https://signalforge-nfmczeqn.manus.space/api/reply-hub/inbound` unless you move the application to a custom domain. |

## Deploy the Worker

1. In SignalForge, open **Reply Hub → Configure inbox**. Enter the address on your domain and save it. Copy the signing secret immediately.
2. Copy `cloudflare-reply-hub/wrangler.toml.example` to `cloudflare-reply-hub/wrangler.toml`.
3. From `cloudflare-reply-hub`, install the worker packages and set each Worker secret. Do not place any secret in `wrangler.toml` or source code.

```bash
npm install
npx wrangler secret put SIGNALFORGE_ENDPOINT
npx wrangler secret put SIGNALFORGE_SHARED_SECRET
npx wrangler secret put SIGNALFORGE_WORKSPACE_ID
npx wrangler secret put SIGNALFORGE_INBOUND_ADDRESS
npm run deploy
```

Copy `SIGNALFORGE_ENDPOINT`, `SIGNALFORGE_WORKSPACE_ID`, and `SIGNALFORGE_INBOUND_ADDRESS` directly from **Reply Hub → Configure inbox → Cloudflare worker handoff**. `SIGNALFORGE_INBOUND_ADDRESS` must exactly match the address configured in SignalForge.

4. In the Cloudflare dashboard, enable **Email Routing** for your domain and create a route for the configured reply address to this Worker. Cloudflare’s local-development guide describes testing an Email Routing Worker before production. [1]
5. Send a deliberate test reply from a mailbox you control. It should appear in SignalForge as a **Reply**, **Bounce**, **Out of office**, or **Opt-out** event. A test opt-out should add the sender to the suppression list.

## Security boundary

| Boundary | Enforcement |
| --- | --- |
| Worker to SignalForge | HMAC-SHA256 signature over the exact JSON body. |
| Workspace routing | The signed payload contains a workspace ID and must match the enabled Reply Hub configuration. |
| Inbox routing | SignalForge accepts only the configured inbound address for the workspace. |
| Duplicate delivery | Provider message ID and body hash are both uniquely constrained per workspace. |
| Unknown mail | It is stored as quarantined rather than treated as a prospect reply. |
| Opt-outs | Classified opt-outs automatically add the sender to suppression; no further outreach draft or send may proceed. |
| Responses | The application can save a response draft only. There is no inbound route that sends mail. |

## Operational notes

Cloudflare’s own Agentic Inbox reference is a useful architecture reference for protected inbound mail, but SignalForge intentionally retains its own user-scoped authorization and human approval model rather than a shared inbox model. [2]

If the signing secret is exposed, turn off the Reply Hub route, rotate the secret in SignalForge, update the Worker secret, and redeploy. Do not reuse the secret in any other application.

## References

[1] [Cloudflare Docs — Email routing local development](https://developers.cloudflare.com/email-service/local-development/routing/)

[2] [Cloudflare — Agentic Inbox](https://github.com/cloudflare/agentic-inbox)
