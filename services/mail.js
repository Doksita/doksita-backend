const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send OTP email for password reset.
 */
async function sendOtpEmail(email, nama, otpCode) {
  await transporter.sendMail({
    from: `"DOKSITA BPN" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Kode OTP Reset Password - DOKSITA",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0369a1; text-align: center;">DOKSITA</h2>
        <p>Halo <strong>${nama}</strong>,</p>
        <p>Anda menerima email ini karena ada permintaan reset password untuk akun Anda.</p>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Kode OTP Anda:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0369a1; margin: 0;">${otpCode}</p>
        </div>
        <p style="color: #64748b; font-size: 13px;">Kode ini berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Jika Anda tidak meminta reset password, abaikan email ini.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
