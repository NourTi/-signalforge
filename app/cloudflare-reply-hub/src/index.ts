import PostalMime from "postal-mime";

type Env = {
  SIGNALFORGE_ENDPOINT: string;
  SIGNALFORGE_SHARED_SECRET: string;
  SIGNALFORGE_WORKSPACE_ID: string;
  SIGNALFORGE_INBOUND_ADDRESS: string;
};

type EmailMessage = {
  from: string;
  to: string;
  raw: ReadableStream;
};

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function signedPayload(rawBody: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return `sha256=${hex(signature)}`;
}

export default {
  async email(message: EmailMessage, env: Env) {
    const parser = new PostalMime();
    const parsed = await parser.parse(await new Response(message.raw).arrayBuffer());
    const payload = {
      workspaceId: Number(env.SIGNALFORGE_WORKSPACE_ID),
      // Message-ID makes delivery retry-safe. The deterministic fallback remains scoped to the worker event.
      messageId: parsed.messageId || `${message.from}:${message.to}:${parsed.date || new Date().toISOString()}:${parsed.subject || ""}`,
      from: message.from.toLowerCase(),
      to: env.SIGNALFORGE_INBOUND_ADDRESS.toLowerCase(),
      subject: (parsed.subject || "").slice(0, 500),
      text: (parsed.text || "").slice(0, 10000),
      receivedAt: new Date().toISOString(),
    };
    const rawBody = JSON.stringify(payload);
    const response = await fetch(env.SIGNALFORGE_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signalforge-signature": await signedPayload(rawBody, env.SIGNALFORGE_SHARED_SECRET),
      },
      body: rawBody,
    });
    if (!response.ok) {
      // Cloudflare can retry a failed routing event; SignalForge deduplicates by Message-ID and body hash.
      throw new Error(`SignalForge Reply Hub rejected inbound message: ${response.status}`);
    }
  },
};
