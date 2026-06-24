import { Suspense } from "react";
import { TasksModule } from "@/components/features/tasks/tasks-module";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <LoadingIndicator title="Loading tasks" description="Preparing task workspace…" />
        </div>
      }
    >
      <TasksModule />
    </Suspense>
  );
}
