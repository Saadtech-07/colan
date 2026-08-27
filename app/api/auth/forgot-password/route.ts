import { NextResponse } from "next/server";
import { resolvePasswordResetUrl } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/services/email-service";
import { forgotPasswordSchema } from "@/lib/validations";

const GENERIC_SUCCESS =
  "If an account exists for that email, a password reset link has been sent.";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const origin = new URL(req.url).origin;

  try {
    const created = await createPasswordResetToken(email);
    if (created) {
      const resetUrl = resolvePasswordResetUrl(created.token, origin);
      if (resetUrl) {
        await sendPasswordResetEmail({
          employeeName: created.name,
          employeeEmail: email,
          resetUrl,
          expiresHours: 3,
        });
      }
    }
  } catch (error) {
    console.warn("[password-reset] forgot-password failed", {
      email,
      error: error instanceof Error ? error.message : error,
    });
  }

  return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
}
