import type { ColanLayoutState, LayoutEditorApplyResult } from "@/lib/seating-layout-editor-types";
import { parseApiError } from "@/providers/app-state";

export async function requestColanLayoutEdit(input: {
  prompt: string;
  layout: ColanLayoutState;
}): Promise<LayoutEditorApplyResult> {
  const res = await fetch("/api/seating/layout-edit", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  return (await res.json()) as LayoutEditorApplyResult;
}
