import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  title?: string;
  logo?: ReactNode;
  navItems: NavItem[];
  children: ReactNode;
}

export function DashboardLayout({ title = "App", logo, navItems, children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6 font-semibold">
          {logo}
          <span>{title}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="text-lg font-semibold">{title}</h1>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
