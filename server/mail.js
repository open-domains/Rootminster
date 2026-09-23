import nodemailer from 'nodemailer';
import { config } from './config.js';
import { getModuleConfig } from './module-settings.js';
import { renderTablerEmail, emailPlainText } from './lib/tabler-email.js';

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

export async function sendEmail({ to, subject, body, text }) {
  const { transport, smtp } = await getTransporter();
  if (!transport) {
    if (!config.production) console.log(`[mail disabled] ${subject} -> ${to}`);
    return { accepted: [], disabled: true };
  }
  return transport.sendMail({
    from: smtp.from,
    to,
    subject,
    html: renderTablerEmail(subject, body),
    text: text || emailPlainText(body),
  });
}
