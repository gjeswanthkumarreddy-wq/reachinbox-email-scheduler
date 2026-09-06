import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let _transport: Transporter | null = null;

export async function getTransporter(): Promise<Transporter> {
  if (_transport) return _transport;

  const user = process.env.ETHEREAL_USER;
  const pass = process.env.ETHEREAL_PASS;

  if (user && pass) {
    _transport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
    console.log("[Mailer] Using configured Ethereal account:", user);
  } else {
    const account = await nodemailer.createTestAccount();
    console.log("[Mailer] Auto-created Ethereal account:", account.user);
    _transport = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
  }
  return _transport;
}

export async function sendEmail(opts: {
  to: string;
  from: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string; previewUrl: string | false }> {
  const transport = await getTransporter();
  const info = await transport.sendMail(opts);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[Mailer] Sent to ${opts.to} | Preview: ${previewUrl}`);
  return { messageId: info.messageId, previewUrl };
}
