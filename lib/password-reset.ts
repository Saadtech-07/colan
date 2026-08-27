import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureColanModelIndexes } from "@/models";

const TOKEN_TTL_MS = 3 * 60 * 60 * 1000;

type PasswordResetDocument = {
  _id: ObjectId;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
};

export type PasswordResetTokenPreview = {
  email: string;
  name: string;
};

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRawToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(
  email: string,
): Promise<{ token: string; name: string } | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;

  const db = await getDb();
  if (!db) return null;

  await ensureColanModelIndexes(db);

  const user = await db.collection(COLLECTIONS.appUsers).findOne({ email: normalized });
  if (!user || typeof user.passwordHash !== "string") return null;

  const token = createRawToken();
  const tokenHash = hashResetToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  const col = db.collection<PasswordResetDocument>(COLLECTIONS.passwordResetTokens);
  await col.deleteMany({ email: normalized, usedAt: { $exists: false } });
  await col.insertOne({
    _id: new ObjectId(),
    email: normalized,
    tokenHash,
    expiresAt,
    createdAt: now,
  });

  const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : normalized;
  return { token, name };
}

export async function getPasswordResetPreview(
  token: string,
): Promise<PasswordResetTokenPreview | null> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return null;

  const db = await getDb();
  if (!db) return null;

  await ensureColanModelIndexes(db);

  const row = await db.collection<PasswordResetDocument>(COLLECTIONS.passwordResetTokens).findOne({
    tokenHash: hashResetToken(normalizedToken),
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
  if (!row) return null;

  const user = await db.collection(COLLECTIONS.appUsers).findOne({ email: row.email });
  const name =
    typeof user?.name === "string" && user.name.trim() ? user.name.trim() : row.email;

  return { email: row.email, name };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const normalizedToken = token.trim();
  const password = newPassword.trim();

  if (!normalizedToken) {
    return { ok: false, reason: "Reset link is invalid." };
  }
  if (password.length < 6) {
    return { ok: false, reason: "Password must be at least 6 characters." };
  }

  const db = await getDb();
  if (!db) {
    return { ok: false, reason: "Password reset is unavailable right now." };
  }

  await ensureColanModelIndexes(db);

  const col = db.collection<PasswordResetDocument>(COLLECTIONS.passwordResetTokens);
  const row = await col.findOne({
    tokenHash: hashResetToken(normalizedToken),
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!row) {
    return { ok: false, reason: "This reset link is invalid or has expired." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userResult = await db.collection(COLLECTIONS.appUsers).updateOne(
    { email: row.email },
    { $set: { passwordHash, updatedAt: new Date() } },
  );

  if (userResult.matchedCount === 0) {
    return { ok: false, reason: "Account not found." };
  }

  await col.updateOne({ _id: row._id }, { $set: { usedAt: new Date() } });
  await col.deleteMany({ email: row.email, _id: { $ne: row._id } });

  return { ok: true };
}
