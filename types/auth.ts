import type { AppRole, TeamName } from "@/types";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  appRole: AppRole;
  team?: TeamName;
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
  isProfileCompleted: boolean;
};
