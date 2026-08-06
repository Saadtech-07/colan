import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listEmployees } from "@/lib/data-service";
import { getFloorPlanBySlug, normalizeOfficeSlug } from "@/lib/floor-plans";
import { employeeEligibleForSeating } from "@/lib/workspace-identity";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const officeSlug = normalizeOfficeSlug(slug);

  try {
    const plan = await getFloorPlanBySlug(officeSlug);
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
    }

    const employees = await listEmployees();
    const bySeat = new Map<
      string,
      {
        id: string;
        employeeId: string;
        name: string;
        team: string;
        role: string;
        imageUrl: string;
      }
    >();

    for (const emp of employees) {
      if (!employeeEligibleForSeating(emp)) continue;
      if (!emp.bayNumber || !plan.seatIds.includes(emp.bayNumber)) continue;
      const empOffice = normalizeOfficeSlug(emp.officeSlug);
      if (empOffice !== officeSlug) continue;
      if (bySeat.has(emp.bayNumber)) continue;
      bySeat.set(emp.bayNumber, {
        id: emp.id,
        employeeId: emp.employeeId,
        name: emp.name,
        team: emp.team,
        role: emp.role,
        imageUrl: emp.imageUrl,
      });
    }

    const seats = plan.seatIds.map((bayId) => {
      const employee = bySeat.get(bayId) ?? null;
      return {
        bayId,
        status: employee ? ("occupied" as const) : ("empty" as const),
        employee,
      };
    });

    return NextResponse.json({
      slug: plan.slug,
      name: plan.name,
      seatCount: plan.seatIds.length,
      occupied: seats.filter((s) => s.status === "occupied").length,
      seats,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load occupancy";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
