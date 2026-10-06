// Brevo (formerly Sendinblue) transactional email via its REST API.
// Uses Node's built-in fetch (Node 18+), so there is no SDK to install.
// Docs: https://developers.brevo.com/reference/sendtransacemail
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

let warnedOnce = false;

function isConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

// Sends an email through Brevo if configured; otherwise logs and returns
// { sent: false } rather than throwing, so the cron job and the manual
// "email this alert now" button degrade gracefully in environments that
// haven't set up a Brevo key yet.
export async function sendEmail({ to, subject, html, text }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) {
    return { sent: false, reason: 'No recipients' };
  }

  if (!isConfigured()) {
    if (!warnedOnce) {
      console.warn(
        '[emailService] BREVO_API_KEY / BREVO_SENDER_EMAIL not set — emails will be logged, not sent. See server/.env.example.'
      );
      warnedOnce = true;
    }
    console.log(`[emailService] (not sent) To: ${recipients.join(', ')} | Subject: ${subject}`);
    return { sent: false, reason: 'Brevo not configured' };
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'StockFlow',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: recipients.map((email) => ({ email })),
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Brevo API error ${response.status}: ${details}`);
  }

  const data = await response.json().catch(() => ({}));
  return { sent: true, messageId: data.messageId };
}
