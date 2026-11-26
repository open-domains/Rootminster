import { config } from '../core/config.js';
import { escapeHtml } from '../lib/html.js';
import { emailDeliveryEnabled, sendEmail } from '../core/mail.js';
import { getModuleConfig } from '../core/module-settings.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

export function validateContactInput(input = {}) {
  const message = {
    name: clean(input.name, 120),
    email: clean(input.email, 254),
    subject: clean(input.subject, 200),
    message: clean(input.message, 10_000),
  };
  if (!message.subject || !message.message || !message.email) {
    throw Object.assign(new Error('Subject, message, and email are required'), { status: 400 });
  }
  if (!EMAIL.test(message.email)) throw Object.assign(new Error('Enter a valid email address'), { status: 400 });
  return message;
}

export function contactEmailBody({ name, email, subject, message }) {
  return [
    '<p>New message from the Rootminster contact form.</p>',
    `<p><strong>From:</strong> ${escapeHtml(name || 'Not given')} &lt;${escapeHtml(email)}&gt;<br>`,
    `<strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
    `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
  ].join('\n');
}

// Public contact form. Messages go to the email module's contact recipient.
export async function registerContactRoutes(app) {
  app.post('/api/contact', { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const input = validateContactInput(request.body || {});
    const email = await getModuleConfig('email');
    const to = email.contact_email || config.contactEmail;
    if (!to || !(await emailDeliveryEnabled())) {
      return reply.code(503).send({ error: 'The contact form is not available right now. Please email us instead.' });
    }
    await sendEmail({ to, subject: `[Contact] ${input.subject}`, body: contactEmailBody(input) });
    return { success: true };
  });
}
