import { NextResponse } from "next/server";
import { getPasswordResetPreview, resetPasswordWithToken } from "@/lib/password-reset";
import { resetPasswordSchema } from "@/lib/validations";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ valid: false, error: "Reset link is invalid." }, { status: 400 });
  }

  const preview = await getPasswordResetPreview(token);
  if (!preview) {
    return NextResponse.json(
      { valid: false, error: "This reset link is invalid or has expired." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    valid: true,
    email: preview.email,
    name: preview.name,
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Password updated successfully. You can sign in with your new password.",
  });
}
