/**
 * ==============================================================================
 * Aspectt OTT Platform - Transactional Email & OTP Service (Brevo REST API)
 * ==============================================================================
 * Dispatches 6-digit verification codes using Brevo's v3 SMTP REST API:
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 *
 * Replaces Resend to deliver OTPs to any email address without custom domain gating.
 */

// In-memory OTP storage with 10-minute TTL
const otpStore = new Map();

/**
 * Generates a clean 6-digit numeric OTP code
 * @returns {string} 6-digit code (e.g. '482910')
 */
export function generateOtp(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Stores an OTP with a 10-minute expiration
 * @param {string} email
 * @param {string} otp
 * @param {number} ttlMs - Default: 10 minutes (600,000ms)
 */
export function storeOtp(email, otp, ttlMs = 10 * 60 * 1000) {
  if (!email || !otp) return;
  const key = email.trim().toLowerCase();
  otpStore.set(key, {
    otp: String(otp).trim(),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
  });
}

/**
 * Validates an OTP code for a given email address
 * @param {string} email
 * @param {string} enteredOtp
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyOtp(email, enteredOtp) {
  if (!email || !enteredOtp) {
    return { valid: false, reason: 'Email and OTP are required.' };
  }

  const key = email.trim().toLowerCase();
  const record = otpStore.get(key);

  if (!record) {
    return { valid: false, reason: 'No OTP requested for this email or it has expired.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { valid: false, reason: 'Verification code has expired. Please request a new code.' };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    otpStore.delete(key);
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (record.otp !== String(enteredOtp).trim()) {
    return { valid: false, reason: 'Invalid verification code. Please check and try again.' };
  }

  // Successfully matched — clear OTP to prevent reuse
  otpStore.delete(key);
  return { valid: true };
}

/**
 * Checks if an email currently has a pending valid OTP
 * @param {string} email
 * @returns {boolean}
 */
export function hasValidOtp(email) {
  if (!email) return false;
  const key = email.trim().toLowerCase();
  const record = otpStore.get(key);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  return true;
}

/**
 * Generates dark-mode cinema branded HTML template for Aspectt OTP emails
 */
export function generateOtpHtml({ userName, otp, title = 'Verify Your Account' }) {
  const safeName = userName ? String(userName).replace(/[&<>"']/g, '') : 'Cinephile';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Aspectt Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121316; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #EDEDED;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #121316; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #1E2024; border: 1px solid #353941; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; text-align: center; background-color: #1A1C20; border-bottom: 1px solid #282B30;">
              <span style="font-size: 22px; font-weight: 800; letter-spacing: 3px; color: #FFFFFF; text-transform: uppercase;">
                ASPECT<span style="color: #7E57C2;">T</span>
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px; text-align: center;">
              <h1 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px;">
                ${title}
              </h1>
              <p style="font-size: 14px; color: #B8BCC4; line-height: 1.6; margin: 0 0 28px;">
                Hello <strong style="color: #FFFFFF;">${safeName}</strong>,<br>
                Use the 6-digit one-time verification code below to complete your authentication on Aspectt:
              </p>

              <!-- OTP Code Display Box -->
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin: 0 auto 28px; background-color: #282B30; border: 2px dashed #7E57C2; border-radius: 10px;">
                <tr>
                  <td style="padding: 20px 32px; text-align: center;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #FFFFFF; text-indent: 10px;">
                      ${otp}
                    </div>
                    <div style="display: inline-block; margin-top: 10px; font-size: 11px; font-weight: 600; color: #7E57C2; background-color: rgba(126, 87, 194, 0.15); border-radius: 4px; padding: 4px 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                      &#x23F1; Valid for 10 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #8A8F99; line-height: 1.6; margin: 0 0 12px;">
                For your security, never share this code with anyone. Aspectt curators and support staff will never ask for your verification code.
              </p>
              <p style="font-size: 12px; color: #6C727F; line-height: 1.5; margin: 0;">
                If you did not initiate this request, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #16181B; border-top: 1px solid #282B30; text-align: center; font-size: 11px; color: #6C727F; line-height: 1.5;">
              &copy; ${new Date().getFullYear()} Aspectt OTT Platform &bull; Curated Independent Cinema<br>
              This is an automated transactional security email sent via Brevo API.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a transactional OTP email using Brevo's v3 SMTP REST API
 *
 * @param {object} params
 * @param {string} params.toEmail - Recipient email address
 * @param {string} [params.toName] - Recipient display name
 * @param {string} params.otp - 6-digit numeric OTP string
 * @returns {Promise<{ success: boolean, messageId?: string, simulated?: boolean }>}
 */
export async function sendOtpEmail({ toEmail, toName, otp, subject, title }) {
  if (!toEmail || typeof toEmail !== 'string' || !toEmail.trim()) {
    throw new Error('Recipient email is required to send verification OTP.');
  }
  if (!otp || typeof otp !== 'string' || !otp.trim()) {
    throw new Error('OTP code is required to send verification email.');
  }

  const cleanEmail = toEmail.trim().toLowerCase();
  const cleanName = toName && typeof toName === 'string' ? toName.trim() : 'Aspectt User';
  const cleanOtp = String(otp).trim();

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || 'noreply@aspectt.com';

  const htmlContent = generateOtpHtml({
    userName: cleanName,
    otp: cleanOtp,
    title: title || 'Verify Your Account',
  });

  // Simulated fallback in development if Brevo API key is not yet set
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_brevo_api_key')) {
    console.warn('\n⚠️  [Aspectt Email Service] BREVO_API_KEY is not set in .env');
    console.warn(`   Simulated Brevo OTP for ${cleanEmail}: [${cleanOtp}] (Valid for 10 minutes)\n`);
    return {
      success: true,
      simulated: true,
      message: `OTP [${cleanOtp}] generated for development (add BREVO_API_KEY to send real emails).`,
    };
  }

  // Exact JSON payload required by Brevo Transactional Email REST API
  const payload = {
    sender: {
      name: 'Aspectt',
      email: senderEmail.trim(),
    },
    to: [
      {
        email: cleanEmail,
        name: cleanName,
      },
    ],
    subject: subject || 'Your Aspectt Verification Code (OTP)',
    htmlContent,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey.trim(),
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP ${response.status} ${response.statusText}`;
    console.error('❌ [Brevo API Error]:', response.status, errorMsg);
    throw new Error(`Failed to send OTP via Brevo API: ${errorMsg}`);
  }

  console.log(`✔ [Brevo API] Verification OTP email dispatched to ${cleanEmail}. Message ID: ${data?.messageId || 'OK'}`);
  return {
    success: true,
    messageId: data?.messageId,
  };
}

export default {
  generateOtp,
  storeOtp,
  verifyOtp,
  hasValidOtp,
  generateOtpHtml,
  sendOtpEmail,
};

