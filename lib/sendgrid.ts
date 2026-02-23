/**
 * SendGrid client for sending transactional emails.
 * Used for approval notifications, event reminders, system alerts.
 */

import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.APP_EMAIL_FROM ?? "noreply@churchapp.local";

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  if (!apiKey) {
    console.warn("SendGrid API key not set; email not sent:", params.subject);
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: fromEmail,
      subject: params.subject,
      html: params.html,
      text: params.text ?? params.html.replace(/<[^>]*>/g, ""),
    });
    return true;
  } catch (err) {
    console.error("SendGrid error:", err);
    return false;
  }
}

export { fromEmail };
