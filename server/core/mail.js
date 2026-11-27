import nodemailer from 'nodemailer';
import { config } from './config.js';
import { displayNameFor, sendHostingerMail } from '../integrations/hostinger-mail.js';
import { getModuleConfig } from './module-settings.js';
import { buildEmailParts } from '../lib/email-format.js';
import { platformName } from '../lib/platform-name.js';

let transporter;
let transporterKey;

async function getTransporter() {
  const smtp = await getModuleConfig('email');
  const key = JSON.stringify([smtp.enabled, smtp.host, smtp.port, smtp.secure, smtp.user, smtp.password]);
  if (key === transporterKey) return { transport: transporter, smtp };
  transporterKey = key;
  if (!smtp.enabled || !smtp.host) {
    transporter = null;
    return { transport: transporter, smtp };
  }
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return { transport: transporter, smtp };
}

function hostingerReady(settings) {
  return Boolean(settings.enabled && settings.api_token && settings.mailbox_resource_id);
}

// Which email handler delivers mail: Hostinger Mail when it is enabled and
// configured, otherwise SMTP from the Email module, otherwise none.
export async function activeEmailHandler() {
  const hostinger = await getModuleConfig('hostinger_mail');
  if (hostingerReady(hostinger)) return 'hostinger_mail';
  const smtp = await getModuleConfig('email');
  return smtp.enabled && smtp.host ? 'smtp' : null;
}

export async function emailDeliveryEnabled() {
  return Boolean(await activeEmailHandler());
}

// `body` is an HTML fragment (or a full HTML document, sent as is). Fragments
// are wrapped in the branded email layout, and a plain-text part with the
// links written out is added unless `text` is given. `preheader` is the short
// summary inboxes show beside the subject; `footer` replaces the default
// footer line (trusted HTML).
export async function sendEmail({ to, subject, body, text, preheader, footer }) {
  const parts = buildEmailParts({ subject, body, text, preheader, footer, platformName: await platformName(), appUrl: config.appUrl });
  const hostinger = await getModuleConfig('hostinger_mail');
  if (hostingerReady(hostinger)) {
    const smtp = await getModuleConfig('email');
    return sendHostingerMail(hostinger, { to, subject, body: parts.html, text: parts.text, displayName: displayNameFor(hostinger, smtp.from) });
  }
  const { transport, smtp } = await getTransporter();
  if (!transport) {
    if (!config.production) console.log(`[mail disabled] ${subject} -> ${to}`);
    return { accepted: [], disabled: true };
  }
  return transport.sendMail({
    from: smtp.from,
    to,
    subject,
    html: parts.html,
    text: parts.text,
  });
}
