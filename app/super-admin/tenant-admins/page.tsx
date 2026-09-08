import * as React from "react";
import { InlinePageLoader } from "@/components/ui/inline-page-loader";
import { TenantAdminsPageContent } from "./tenant-admins-content";

export default function TenantAdminsPage() {
  return (
    <React.Suspense fallback={<InlinePageLoader title="Loading tenant admins…" />}>
      <TenantAdminsPageContent />
    </React.Suspense>
  );
}
