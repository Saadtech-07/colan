"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  imageUrl?: string;
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = options.filter((option) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      option.label.toLowerCase().includes(query) ||
      option.description?.toLowerCase().includes(query)
    );
  });

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-3.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary/30 ring-1 ring-primary/15",
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          {selected?.imageUrl ? (
            <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border/60">
              <AvatarImage src={selected.imageUrl} alt={selected.label} />
              <AvatarFallback>{selected.label.slice(0, 2)}</AvatarFallback>
            </Avatar>
          ) : null}
          <span
            className={cn(
              "truncate",
              selected ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-lg">
          <div className="border-b border-border/60 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 rounded-xl border-border/70 bg-background/80 pl-9"
                autoFocus
              />
            </div>
          </div>

          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto p-1.5"
            aria-labelledby={id}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "bg-primary/[0.08] text-foreground"
                          : "text-foreground hover:bg-muted/60",
                      )}
                    >
                      {option.imageUrl ? (
                        <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/60">
                          <AvatarImage src={option.imageUrl} alt={option.label} />
                          <AvatarFallback>{option.label.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{option.label}</span>
                        {option.description ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
