export type DataLayerSummary =
  | {
      backend: "memory";
      reason: string;
    }
  | {
      backend: "mongodb";
      database: string;
      counts: {
        employees: number;
        projects: number;
        gallery: number;
        appUsers: number;
      };
    }
  | {
      backend: "error";
      message: string;
    };
