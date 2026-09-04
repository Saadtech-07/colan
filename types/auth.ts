import type { AppRole, TeamName } from "@/types";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  appRole: AppRole;
  team?: TeamName;
  companyId: string;
  /** MongoDB appUsers _id — avoids a DB lookup on chat/notification routes. */
  appUserId?: string;
  isProfileCompleted: boolean;
};

export type Session = {
  user: AuthUser;
};

export type JwtPayload = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  appRole: AppRole;
  team?: TeamName;
  companyId: string;
  appUserId?: string;
  isProfileCompleted: boolean;
};
