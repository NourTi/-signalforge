export async function sendTelegramAlert({ token, chatId, text }: { token: string; chatId: string; text: string }) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error("Telegram notification failed.");
  const payload = await response.json() as { ok?: boolean };
  if (!payload.ok) throw new Error("Telegram notification failed.");
}

export function shouldDeliverDiscoverySaveAlert({ enabled, explicitSave }: { enabled: boolean; explicitSave: boolean }) {
  return enabled && explicitSave;
}
