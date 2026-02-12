"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

type NavItem = {
  href: string;
  icon: string;
  activeIcon: string;
  label: string;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: "home",
    activeIcon: "home",
    label: "Listings",
    requiresAuth: true,
  },
  {
    href: "/dashboard/listings",
    icon: "photo_library",
    activeIcon: "photo_library",
    label: "All",
    requiresAuth: true,
  },
  {
    href: "/admin",
    icon: "dashboard",
    activeIcon: "dashboard",
    label: "Admin",
    requiresAdmin: true,
  },
  {
    href: "/admin/users",
    icon: "group",
    activeIcon: "group",
    label: "Users",
    requiresAdmin: true,
  },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN" || userRole === "LISTINGS";

  const visibleItems = navItems.filter((item) => {
    if (item.requiresAdmin && !isAdmin) return false;
    return true;
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-primary z-50">
      {/* Top gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      <div className="px-2 py-2 flex justify-around items-center pb-safe">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center py-1.5 px-4 rounded-xl
                transition-all duration-200
                ${isActive ? "text-gold" : "text-white/50 active:text-white/70"}
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-gold" />
              )}

              <span
                className={`
                  material-symbols-outlined text-[22px]
                  ${isActive ? "material-symbols-filled" : ""}
                `}
                style={
                  isActive
                    ? {
                        fontVariationSettings: '"FILL" 1, "wght" 500',
                      }
                    : undefined
                }
              >
                {isActive ? item.activeIcon : item.icon}
              </span>
              <span
                className={`
                  text-[9px] mt-0.5 font-semibold tracking-wider uppercase
                  transition-colors duration-200
                `}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
