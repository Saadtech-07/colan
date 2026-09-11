import type { TeamDTO } from "@/models";
import type { Employee, GalleryImage, Project } from "@/types";

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
      employees: [],
      projects: [],
      gallery: [],
      teams: [],
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
      employees: [],
      projects: [],
      gallery: [],
      teams: [],
    };
  },
};
