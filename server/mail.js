import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (!config.smtp.host) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return transporter;
}

export async function sendEmail({ to, subject, body, text }) {
  const transport = getTransporter();
  if (!transport) {
    if (!config.production) console.log(`[mail disabled] ${subject} -> ${to}`);
    return { accepted: [], disabled: true };
  }
  return transport.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html: body,
    text: text || String(body || '').replace(/<[^>]*>/g, ' '),
  });
}
