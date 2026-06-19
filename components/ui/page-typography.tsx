import * as React from "react";
import { cn } from "@/lib/utils";

/** Top chrome title — Dashboard, Team members, Roles, etc. */
export const pageTitleClassName =
  "font-heading text-xl font-bold leading-tight tracking-[-0.02em] text-foreground sm:text-2xl";

/** In-page section title — Team directory, Project analytics, etc. */
export const sectionTitleClassName =
  "font-heading text-lg font-bold leading-snug tracking-[-0.015em] text-foreground sm:text-xl";

/** Card / panel subsection title — Current projects, Seat assignment, etc. */
export const subsectionTitleClassName =
  "font-heading text-sm font-semibold leading-snug tracking-[-0.01em] text-foreground sm:text-[15px]";

export const sectionDescriptionClassName =
  "text-sm leading-relaxed text-muted-foreground sm:text-[15px]";

export function PageTitle({
  children,
  className,
  as: Tag = "h1",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "p" | "span";
}) {
  return <Tag className={cn(pageTitleClassName, className)}>{children}</Tag>;
}

export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p";
}) {
  return <Tag className={cn(sectionTitleClassName, className)}>{children}</Tag>;
}

export function SubsectionTitle({
  children,
  className,
  as: Tag = "h4",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h3" | "h4" | "p";
}) {
  return <Tag className={cn(subsectionTitleClassName, className)}>{children}</Tag>;
}
