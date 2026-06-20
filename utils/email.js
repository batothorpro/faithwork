const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function sendPasswordResetEmail(toEmail, nombre, resetToken, accountType = 'user') {
  const resetUrl = `${APP_URL}/reset-password.html?token=${resetToken}&type=${accountType}`;

  const html = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background:#f7f4ef; padding: 32px 20px;">
    <div style="background:#1a2744; padding: 28px 24px; border-radius: 12px 12px 0 0; text-align:center;">
      <div style="color:#c9a84c; font-size: 28px; margin-bottom: 6px;">✦</div>
      <div style="color:#fff; font-size: 22px; font-weight:700; font-family: Georgia, serif;">FaithWork</div>
    </div>
    <div style="background:#fff; padding: 32px 28px; border-radius: 0 0 12px 12px;">
      <p style="font-size:15px; color:#1e1b17; line-height:1.6;">Hola ${nombre || ''},</p>
      <p style="font-size:15px; color:#5c5750; line-height:1.6;">
        Recibimos una solicitud para restablecer tu contraseña en FaithWork. Si fuiste tú, haz clic en el siguiente botón:
      </p>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${resetUrl}" style="background:#1a2744; color:#fff; text-decoration:none; padding: 13px 32px; border-radius: 8px; font-weight:600; font-size:14px; display:inline-block;">
          Restablecer mi contraseña
        </a>
      </div>
      <p style="font-size:13px; color:#9e9a92; line-height:1.6;">
        Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
      </p>
      <p style="font-size:12px; color:#c8c4bc; margin-top: 24px; word-break: break-all;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${resetUrl}
      </p>
    </div>
    <p style="text-align:center; font-size:12px; color:#9e9a92; margin-top:16px;">
      FaithWork — La red laboral de tu comunidad
    </p>
  </div>`;

  try {
    const result = await resend.emails.send({
      from: `FaithWork <${FROM}>`,
      to: toEmail,
      subject: 'Restablece tu contraseña — FaithWork',
      html,
    });
    return { success: true, result };
  } catch (err) {
    console.error('Error enviando email:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendPasswordResetEmail };
