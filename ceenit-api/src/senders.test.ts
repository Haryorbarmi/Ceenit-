import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeCodeSender, whatsappPayload } from './domain/senders';

const ok = () => new Response('{}', { status: 200 });

describe('login code delivery', () => {
  it('sends a phone code through the WhatsApp Cloud API as an authentication template', async () => {
    let url = '', init: RequestInit = { headers: {} };
    const send = makeCodeSender({ WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: '123' }, (async (u: string, i: RequestInit) => { url = u; init = i; return ok(); }) as unknown as typeof fetch);
    await send('2348031234567', 'phone', '482910');
    assert.equal(url, 'https://graph.facebook.com/v21.0/123/messages');
    assert.equal((init.headers as Record<string, string>)['Authorization'], 'Bearer tok');
    const body = JSON.parse(String(init.body));
    assert.deepEqual(body, whatsappPayload('2348031234567', '482910', 'ceeneet_login_code', 'en'));
    assert.match(String(init.body), /482910/);
  });

  it('sends an email code through Resend', async () => {
    let body: any;
    const send = makeCodeSender({ RESEND_API_KEY: 'k', MAIL_FROM: 'Ceeneet <no-reply@example.com>' }, (async (_u: string, i: RequestInit) => { body = JSON.parse(String(i.body)); return ok(); }) as unknown as typeof fetch);
    await send('a@b.com', 'email', '111222');
    assert.deepEqual(body.to, ['a@b.com']);
    assert.match(body.text, /111222/);
  });

  it('turns a provider failure into a friendly error, without leaking details', async () => {
    const send = makeCodeSender({ WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: '123' }, (async () => new Response('{"error":"secret detail"}', { status: 400 })) as unknown as typeof fetch);
    await assert.rejects(send('2348031234567', 'phone', '1'), (e: any) => e.code === 'code_send_failed' && e.status === 502 && !/secret/.test(e.message));
  });

  it('falls back to the server log when no keys are set', async () => {
    const send = makeCodeSender({}, (async () => { throw new Error('should not call out'); }) as unknown as typeof fetch);
    await send('2348031234567', 'phone', '1');
  });
});
