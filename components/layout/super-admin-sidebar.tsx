"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-session-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/companies", label: "Companies", icon: Building2 },
  { href: "/super-admin/tenant-admins", label: "Tenant Admins", icon: UserCog },
  { href: "/super-admin/audit-logs", label: "Audit Logs", icon: ClipboardList },
  { href: "/super-admin/settings", label: "Platform Settings", icon: Settings },
] as const;

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { refresh } = useAuth();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await refresh();
    router.replace("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[14.5rem] flex-col border-r border-border/60 bg-[#0f172a] text-slate-100">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-sky-400" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300/90">
              Colan Platform
            </p>
            <p className="text-sm font-semibold text-white">Super Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sky-500/15 text-sky-100"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start gap-2 text-slate-300 hover:bg-white/5 hover:text-white"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
