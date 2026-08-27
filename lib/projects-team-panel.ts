import type { TeamDTO } from "@/models";

type TeamUpdatedHandler = (previous: TeamDTO, updated: TeamDTO) => void;

let teamUpdatedHandler: TeamUpdatedHandler | null = null;

export function registerTeamUpdatedHandler(handler: TeamUpdatedHandler) {
  teamUpdatedHandler = handler;
  return () => {
    if (teamUpdatedHandler === handler) {
      teamUpdatedHandler = null;
    }
  };
}

export function notifyTeamUpdated(previous: TeamDTO, updated: TeamDTO) {
  teamUpdatedHandler?.(previous, updated);
}
