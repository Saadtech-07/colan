import type { AppRole, TeamName } from "@/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    appRole: AppRole;
    team?: TeamName;
    isProfileCompleted: boolean;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      appRole: AppRole;
      team?: TeamName;
      isProfileCompleted: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appRole?: AppRole;
    team?: TeamName;
    picture?: string | null;
    isProfileCompleted?: boolean;
  }
}
