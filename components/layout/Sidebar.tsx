"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiHome,
  FiFileText,
  FiMusic,
  FiCalendar,
  FiBell,
  FiUsers,
  FiSettings,
  FiBarChart2,
  FiHeart,
  FiMonitor,
} from "react-icons/fi";
import type { RoleSlug } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: RoleSlug[];
  /** If true, also show when the user is a Multimedia ministry member (in addition to `roles`). */
  allowIfMultimediaMember?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <FiHome className="size-5" />,
    roles: ["admin", "ministry_head", "user"],
  },
  {
    href: "/dashboard/forms",
    label: "Forms",
    icon: <FiFileText className="size-5" />,
    roles: ["admin", "ministry_head"],
  },
  {
    href: "/dashboard/lineup",
    label: "Music Lineup",
    icon: <FiMusic className="size-5" />,
    roles: ["admin", "ministry_head", "user"],
  },
  {
    href: "/dashboard/multimedia-checklist",
    label: "Multimedia Checklist",
    icon: <FiMonitor className="size-5" />,
    roles: ["admin"],
    allowIfMultimediaMember: true,
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: <FiCalendar className="size-5" />,
    roles: ["admin", "ministry_head", "user"],
  },
  {
    href: "/dashboard/prayers",
    label: "Prayers",
    icon: <FiHeart className="size-5" />,
    roles: ["admin", "ministry_head", "user"],
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: <FiBell className="size-5" />,
    roles: ["admin", "ministry_head", "user"],
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: <FiUsers className="size-5" />,
    roles: ["admin", "ministry_head"],
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: <FiBarChart2 className="size-5" />,
    roles: ["admin"],
  },
  {
    href: "/dashboard/settings",
    label: "System Settings",
    icon: <FiSettings className="size-5" />,
    roles: ["admin", "ministry_head"],
  },
];

export interface SidebarProps {
  roleSlug: RoleSlug;
  /** On mobile, when true sidebar is hidden (drawer closed). When false, sidebar is visible as overlay. */
  collapsed?: boolean;
  isMultimediaMember?: boolean;
}

export function Sidebar({ roleSlug, collapsed = false, isMultimediaMember = false }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (item.roles.includes(roleSlug)) return true;
    if (item.allowIfMultimediaMember && isMultimediaMember) return true;
    return false;
  });

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-gray-200 bg-[var(--color-card-bg)] transition-[width] md:relative md:z-0 ${collapsed ? "hidden md:flex md:w-16" : "flex md:w-56"} `}
      aria-label="Main navigation"
    >
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)]"
              } ${collapsed ? "justify-center" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="shrink-0" aria-hidden>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
