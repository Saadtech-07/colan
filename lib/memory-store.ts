import type { TeamDTO } from "@/models";
import type { Employee, GalleryImage, Project } from "@/types";
import {
  MOCK_EMPLOYEES,
  MOCK_GALLERY,
  MOCK_PROJECTS,
} from "@/lib/mock-data";
import { DEFAULT_TEAM_NAMES, teamCodeFromName, teamSlugFromName } from "@/lib/team-utils";

function cloneTeams(): TeamDTO[] {
  return DEFAULT_TEAM_NAMES.map((name, index) => ({
    id: `team-seed-${index}`,
    name,
    slug: teamSlugFromName(name),
    code: teamCodeFromName(name),
    displayOrder: index,
  }));
}

function cloneEmployees(): Employee[] {
  return MOCK_EMPLOYEES.map((e) => ({ ...e }));
}

function cloneProjects(): Project[] {
  return MOCK_PROJECTS.map((p) => ({ ...p }));
}

function cloneGallery(): GalleryImage[] {
  return MOCK_GALLERY.map((g) => ({ ...g }));
}

const globalStore = globalThis as typeof globalThis & {
  __colanMem?: {
    employees: Employee[];
    projects: Project[];
    gallery: GalleryImage[];
    teams: TeamDTO[];
  };
};

function mem() {
  if (!globalStore.__colanMem) {
    globalStore.__colanMem = {
      employees: cloneEmployees(),
      projects: cloneProjects(),
      gallery: cloneGallery(),
      teams: cloneTeams(),
    };
  }
  return globalStore.__colanMem;
}

export const memoryStore = {
  get employees() {
    return mem().employees;
  },
  get projects() {
    return mem().projects;
  },
  get gallery() {
    return mem().gallery;
  },
  get teams() {
    return mem().teams;
  },
  reset() {
    globalStore.__colanMem = {
      employees: cloneEmployees(),
      projects: cloneProjects(),
      gallery: cloneGallery(),
      teams: cloneTeams(),
    };
  },
};
