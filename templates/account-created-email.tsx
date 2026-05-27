type Props = {
  employeeName: string;
  employeeEmail: string;
  temporaryPassword: string;
  loginUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildAccountCreatedEmail({
  employeeName,
  employeeEmail,
  temporaryPassword,
  loginUrl,
}: Props) {
  const safeName = escapeHtml(employeeName);
  const safeEmail = escapeHtml(employeeEmail);
  const safePassword = escapeHtml(temporaryPassword);
  const safeLoginUrl = escapeHtml(loginUrl);
  const subject = "Your Colan Infotech account is ready";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:32px 16px;background:#f3f6fb;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="background:#0f172a;border-radius:24px 24px 0 0;padding:32px;">
        <p style="margin:0 0 12px;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.24em;">
          COLAN INFOTECH
        </p>
        <h1 style="margin:0 0 12px;color:#f8fafc;font-size:28px;line-height:1.2;">
          Welcome to your workspace
        </h1>
        <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6;">
          Your employee dashboard access has been created successfully.
        </p>
      </div>

      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 24px 24px;padding:32px;box-shadow:0 20px 45px rgba(15,23,42,.08);">
        <h2 style="margin:0 0 20px;color:#0f172a;font-size:20px;">Account details</h2>
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">Hi ${safeName},</p>
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">
          Your login account is now active. Use the credentials below to sign in and complete your first login.
        </p>

        ${detailCard("Employee name", safeName)}
        ${detailCard("Work email", safeEmail)}
        ${detailCard("Temporary password", safePassword)}
        ${detailCard("Secure login link", safeLoginUrl)}

        <div style="padding-top:12px;padding-bottom:8px;">
          <a
            href="${safeLoginUrl}"
            style="display:inline-block;padding:14px 22px;background:#2563eb;color:#fff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;"
          >
            Sign in to your workspace
          </a>
        </div>

        <p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6;">
          Use the secure login link above with your work email and temporary password. On your first
          sign-in, you will be guided to complete profile setup before accessing the dashboard.
        </p>
      </div>

      <div style="padding:20px 8px 0;">
        <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;">
          If you did not expect this account, please contact your workspace administrator.
        </p>
        <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;">
          Login URL:
          <a href="${safeLoginUrl}" style="color:#2563eb;text-decoration:underline;">${safeLoginUrl}</a>
        </p>
        <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;">
          Colan Infotech Admin Workspace
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "Colan Infotech",
    "",
    "Welcome to your workspace.",
    "",
    `Employee name: ${employeeName}`,
    `Work email: ${employeeEmail}`,
    `Temporary password: ${temporaryPassword}`,
    `Secure login link: ${loginUrl}`,
    "",
    "Sign in with the link above, then complete profile setup on your first login.",
  ].join("\n");

  return { subject, html, text };
}

function detailCard(label: string, value: string): string {
  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:12px;padding:14px 16px;">
      <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">
        ${label}
      </p>
      <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;">
        ${value}
      </p>
    </div>
  `;
}
