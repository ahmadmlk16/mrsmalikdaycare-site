// Sends inquiry emails through Resend (https://resend.com, free tier).
// Needs the RESEND_API_KEY secret. Optional: EMAIL_FROM, INQUIRY_TO.
import { esc } from './util.js';

const DEFAULT_TO = 'mrsmalikdaycare@gmail.com';
const DEFAULT_FROM = "Mrs. Malik's Daycare Website <onboarding@resend.dev>";

export async function sendInquiryEmail(env, inquiry) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'RESEND_API_KEY is not set' };

  const kindLabel = inquiry.kind === 'tour' ? 'Visit request' : 'Inquiry';
  const rows = [
    ['Type', kindLabel],
    ['Name', inquiry.name],
    ['Email', inquiry.email],
    ['Phone', inquiry.phone],
    ["Child's age", inquiry.child_age],
    ['Preferred visit date/time', inquiry.preferred_date],
  ].filter(([, v]) => v);

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#333">
      <h2 style="color:#c8612b;margin:0 0 12px">${esc(kindLabel)} from the website</h2>
      <table cellpadding="6" style="border-collapse:collapse">
        ${rows.map(([k, v]) => `<tr><td style="color:#777">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}
      </table>
      <p style="white-space:pre-wrap;background:#fdf6ec;padding:12px;border-radius:8px">${esc(inquiry.message)}</p>
      <p style="color:#777;font-size:13px">Reply to this email to answer ${esc(inquiry.name)} directly.</p>
    </div>`;
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${inquiry.message}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || DEFAULT_FROM,
      to: [env.INQUIRY_TO || DEFAULT_TO],
      reply_to: inquiry.email,
      subject: `${kindLabel} from ${inquiry.name}`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    return { sent: false, reason: `Resend error ${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  return { sent: true };
}
