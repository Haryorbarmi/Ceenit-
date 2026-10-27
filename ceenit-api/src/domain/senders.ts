import { AppError, CodeSender, consoleCodeSender } from './context';

// Sends login codes: WhatsApp (Meta Cloud API) for phone numbers, email (Resend) as the fallback.
// A channel that has no keys set falls back to printing the code in the server log, which is only fine for development.

type Fetch = typeof fetch;

export type SenderEnv = {
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_TEMPLATE?: string;
  WHATSAPP_LANG?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
};

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Meta's "authentication" templates carry the code in the message body and in the Copy code button. */
export function whatsappPayload(to: string, code: string, template: string, lang: string) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
  };
}

async function failIfBad(res: Response, channel: string): Promise<void> {
  if (res.ok) return;
  const detail = (await res.text().catch(() => '')).slice(0, 300);
  console.error(`[login code] ${channel} send failed (${res.status}): ${detail}`);
  throw new AppError('code_send_failed', 502, 'We could not send your code right now. Please try again in a moment.');
}

export function makeCodeSender(env: SenderEnv, doFetch: Fetch = fetch): CodeSender {
  const wa = env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID ? env : null;
  const mail = env.RESEND_API_KEY && env.MAIL_FROM ? env : null;

  return async (contact, method, code) => {
    if (method === 'phone' && wa) {
      const res = await doFetch(`${GRAPH}/${wa.WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${wa.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(whatsappPayload(contact, code, wa.WHATSAPP_TEMPLATE ?? 'ceeneet_login_code', wa.WHATSAPP_LANG ?? 'en')),
      });
      return failIfBad(res, 'whatsapp');
    }
    if (method === 'email' && mail) {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mail.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: mail.MAIL_FROM,
          to: [contact],
          subject: 'Your Ceeneet code',
          text: `Your Ceeneet login code is ${code}. It expires in 10 minutes. If you did not ask for it, ignore this message.`,
        }),
      });
      return failIfBad(res, 'email');
    }
    return consoleCodeSender(contact, method, code);
  };
}
