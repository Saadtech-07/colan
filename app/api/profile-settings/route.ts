import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  completeCurrentAppUserProfile,
  getCurrentAppUserProfile,
} from "@/lib/app-users";
import { profileSettingsUpdateSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getCurrentAppUserProfile(email);
    return NextResponse.json(profile, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load profile settings." },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = profileSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const profile = await completeCurrentAppUserProfile({
      email,
      imageUrl: parsed.data.imageUrl,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword?.trim() || undefined,
    });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update profile settings." },
      { status: 400 },
    );
  }
}
