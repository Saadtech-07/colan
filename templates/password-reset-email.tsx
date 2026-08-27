type Props = {
  employeeName: string;
  employeeEmail: string;
  resetUrl: string;
  expiresHours: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPasswordResetEmail({
  employeeName,
  employeeEmail,
  resetUrl,
  expiresHours,
}: Props) {
  const safeName = escapeHtml(employeeName);
  const safeEmail = escapeHtml(employeeEmail);
  const safeResetUrl = escapeHtml(resetUrl);
  const subject = "Reset your Colan Infotech password";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:32px 16px;background:#f3f6fb;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="background:#0f172a;border-radius:24px 24px 0 0;padding:32px;text-align:center;">
        <p style="margin:0 0 12px;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.24em;">
          COLAN INFOTECH
        </p>
        <h1 style="margin:0;color:#f8fafc;font-size:28px;line-height:1.2;">
          Reset your password
        </h1>
      </div>

      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 24px 24px;padding:32px;box-shadow:0 20px 45px rgba(15,23,42,.08);">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">Hi ${safeName},</p>
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">
          We received a request to reset the password for <strong>${safeEmail}</strong>.
          Use the button below to choose a new password.
        </p>

        <div style="padding:12px 0 20px;text-align:center;">
          <a
            href="${safeResetUrl}"
            style="display:inline-block;padding:14px 22px;background:#16a34a;color:#fff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;"
          >
            Reset your password
          </a>
        </div>

        <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
          If you do not use this link within ${expiresHours} hours, it will expire.
          You can request a new reset link from the login page.
        </p>

        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>

      <div style="padding:20px 8px 0;text-align:center;">
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
          Colan Infotech Employee Workspace
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "Colan Infotech",
    "",
    "Reset your password",
    "",
    `Hi ${employeeName},`,
    "",
    `We received a request to reset the password for ${employeeEmail}.`,
    `Reset link: ${resetUrl}`,
    "",
    `This link expires in ${expiresHours} hours.`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  return { subject, html, text };
}
