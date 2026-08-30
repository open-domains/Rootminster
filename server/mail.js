import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter = null;

function getTransporter() {
  if (!config.smtp.host) {
    console.error('[mail] SMTP_HOST is missing');
    return null;
  }

  if (transporter) {
    return transporter;
  }

  console.log('[mail] Creating SMTP transporter', {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    user: config.smtp.user ? '[configured]' : '[none]',
    from: config.smtp.from,
  });

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: Number(config.smtp.port),
    secure: Boolean(config.smtp.secure),

    auth: config.smtp.user
      ? {
          user: config.smtp.user,
          pass: config.smtp.password,
        }
      : undefined,

    pool: true,
    maxConnections: 5,
    maxMessages: 100,

    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,

    logger: !config.production,
    debug: !config.production,
  });

  return transporter;
}

export async function verifyEmailConnection() {
  const transport = getTransporter();

  if (!transport) {
    throw new Error('SMTP is not configured');
  }

  try {
    await transport.verify();
    console.log('[mail] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[mail] SMTP verification failed:', error);
    throw error;
  }
}

export async function sendEmail({ to, subject, body, text }) {
  const transport = getTransporter();

  if (!transport) {
    console.error('[mail] Email not sent because SMTP is disabled', {
      to,
      subject,
    });

    return {
      accepted: [],
      rejected: [to],
      disabled: true,
    };
  }

  try {
    console.log(`[mail] Sending "${subject}" to ${to}`);

    const result = await transport.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html: body,
      text:
        text ||
        String(body || '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
    });

    console.log('[mail] Email sent', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
    });

    return result;
  } catch (error) {
    console.error('[mail] Email send failed:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    throw error;
  }
}