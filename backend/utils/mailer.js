const nodemailer = require("nodemailer");

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

const sendInviteEmail = async ({ to, projectName, code, inviteLink }) => {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = `You're invited to join "${projectName}"`;
  const text = [
    `You have been invited to join the project "${projectName}".`,
    `Project code: ${code}`,
    inviteLink ? `Join link: ${inviteLink}` : ""
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1d1d1d;">
      <h2 style="margin: 0 0 8px;">You're invited to join "${projectName}"</h2>
      <p style="margin: 0 0 12px;">Use the project code below to join:</p>
      <div style="font-size: 22px; font-weight: bold; letter-spacing: 2px; margin-bottom: 12px;">
        ${code}
      </div>
      ${inviteLink ? `<p style="margin: 0 0 8px;">Join link: <a href="${inviteLink}">${inviteLink}</a></p>` : ""}
      <p style="margin: 0; color: #555;">If you didn't expect this invite, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
};

const sendPasswordResetEmail = async ({ to, name, resetLink }) => {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = "Reset your Campus Collab password";
  const text = [
    `Hi${name ? ` ${name}` : ""},`,
    "We received a request to reset your password.",
    resetLink ? `Reset link: ${resetLink}` : "",
    "If you didn't request this, you can ignore this email."
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1d1d1d;">
      <h2 style="margin: 0 0 8px;">Reset your password</h2>
      <p style="margin: 0 0 12px;">We received a request to reset your password.</p>
      ${resetLink ? `<p style="margin: 0 0 12px;"><a href="${resetLink}">Reset Password</a></p>` : ""}
      <p style="margin: 0; color: #555;">If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
};

module.exports = {
  sendInviteEmail,
  sendPasswordResetEmail
};
