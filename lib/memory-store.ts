import type { Employee, GalleryImage, Project } from "@/types";
import {
  MOCK_EMPLOYEES,
  MOCK_GALLERY,
  MOCK_PROJECTS,
} from "@/lib/mock-data";

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
  };
};

function mem() {
  if (!globalStore.__colanMem) {
    globalStore.__colanMem = {
      employees: cloneEmployees(),
      projects: cloneProjects(),
      gallery: cloneGallery(),
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
  reset() {
    globalStore.__colanMem = {
      employees: cloneEmployees(),
      projects: cloneProjects(),
      gallery: cloneGallery(),
    };
  },
};
