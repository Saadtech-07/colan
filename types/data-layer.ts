/** One row for the Atlas collections panel (see `/api/db-status`). */
export type AtlasCollectionRow = {
  name: string;
  label: string;
  count: number;
};

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
      /** Every Colan collection name with live document counts. */
      allCollections: AtlasCollectionRow[];
    }
  | {
      backend: "error";
      message: string;
    };
