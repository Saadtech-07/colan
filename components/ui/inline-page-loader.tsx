"use client";

import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

export function InlinePageLoader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[320px] items-center justify-center", className)}>
      <LoadingIndicator title={title} description={description} />
    </div>
  );
}
