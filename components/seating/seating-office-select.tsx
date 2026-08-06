"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FloorPlanSummary } from "@/models/floor-plan.model";

type Props = {
  plans: FloorPlanSummary[];
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
};

export function SeatingOfficeSelect({ plans, value, onChange, disabled }: Props) {
  if (plans.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 w-[220px] rounded-lg text-xs sm:text-sm">
        <SelectValue placeholder="Select office" />
      </SelectTrigger>
      <SelectContent>
        {plans.map((plan) => (
          <SelectItem key={plan.slug} value={plan.slug}>
            {plan.name}
            {plan.city ? ` · ${plan.city}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
