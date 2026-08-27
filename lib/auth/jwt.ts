import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload } from "@/types/auth";
import { AUTH_MAX_AGE_SEC, getAuthSecret } from "@/lib/auth/constants";

function secretKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function signAuthToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    appRole: payload.appRole,
    team: payload.team,
    isProfileCompleted: payload.isProfileCompleted,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifyAuthToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const email =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.sub === "string" && payload.sub.includes("@")
          ? payload.sub
          : "";
    if (!email) return null;

    return {
      sub: typeof payload.sub === "string" ? payload.sub : email,
      email: email.toLowerCase().trim(),
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
      appRole: (payload.appRole as JwtPayload["appRole"]) ?? "employee",
      team: payload.team as JwtPayload["team"],
      isProfileCompleted: payload.isProfileCompleted !== false,
    };
  } catch {
    return null;
  }
}
