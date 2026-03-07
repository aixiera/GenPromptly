"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type OrgSidebarNavProps = {
  orgSlug: string;
};

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: (orgSlug: string) => string;
  isActive: (pathname: string, orgSlug: string) => boolean;
};

function navIcon(path: string): React.ReactNode {
  return (
    <span className="nav-item-icon" aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

const navItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: navIcon("M3.5 4.5h5v5h-5z M11.5 4.5h5v5h-5z M3.5 11.5h5v5h-5z M11.5 11.5h5v5h-5z"),
    href: (orgSlug) => `/app/${orgSlug}/dashboard`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/dashboard`),
  },
  {
    key: "projects",
    label: "Projects",
    icon: navIcon("M2.8 6.2h5.4l1.8 1.8H17a1.2 1.2 0 0 1 1.2 1.2v6.3a1.2 1.2 0 0 1-1.2 1.2H3a1.2 1.2 0 0 1-1.2-1.2V7.4a1.2 1.2 0 0 1 1-1.2z"),
    href: (orgSlug) => `/app/${orgSlug}/projects`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/projects`),
  },
  {
    key: "prompts",
    label: "Prompts",
    icon: navIcon("M5 3.5h7l3 3v10H5z M12 3.5v3h3 M7.2 9h5.6 M7.2 12h5.6"),
    href: (orgSlug) => `/app/${orgSlug}/prompts`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/prompts`),
  },
  {
    key: "tools",
    label: "Tools",
    icon: navIcon("M12.8 3.8 16.2 7.2 9 14.4 5.6 11z M4.2 13.8l2 2"),
    href: (orgSlug) => `/app/${orgSlug}/tools`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/tools`),
  },
  {
    key: "compliance",
    label: "Compliance",
    icon: navIcon("M10 2.5 16.5 5.5v4.4c0 4-2.2 6.2-6.5 7.6-4.3-1.4-6.5-3.6-6.5-7.6V5.5z M7.4 9.8 9.3 11.7 12.8 8.2"),
    href: (orgSlug) => `/app/${orgSlug}/compliance`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/compliance`),
  },
  {
    key: "usage",
    label: "Usage",
    icon: navIcon("M3.5 16.5h13 M5.6 14V8.8 M10 14V5.8 M14.4 14v-3.6"),
    href: (orgSlug) => `/app/${orgSlug}/usage`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/usage`),
  },
  {
    key: "audit",
    label: "Audit",
    icon: navIcon("M10 3.2a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6z M10 6.5v4.1l2.8 1.6"),
    href: (orgSlug) => `/app/${orgSlug}/audit`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/audit`),
  },
  {
    key: "billing",
    label: "Billing",
    icon: navIcon("M2.5 6.2h15v8.6h-15z M2.5 8.4h15 M5.6 11.8h2.6"),
    href: (orgSlug) => `/app/${orgSlug}/billing`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/billing`),
  },
  {
    key: "team",
    label: "Team",
    icon: navIcon("M6.6 8.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z M13.8 8.8a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z M2.8 15.8c0-2.3 1.8-4.1 4.1-4.1h1.6c2.3 0 4.1 1.8 4.1 4.1 M11 15.8c.2-1.7 1.6-3 3.3-3h.9c1.1 0 2.1.4 2.8 1.2"),
    href: (orgSlug) => `/app/${orgSlug}/team`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/app/${orgSlug}/team`),
  },
];

export function OrgSidebarNav({ orgSlug }: OrgSidebarNavProps) {
  const pathname = usePathname() ?? "";
  const encodedOrgSlug = encodeURIComponent(orgSlug);

  return (
    <nav className="side-nav">
      {navItems.map((item) => {
        const href = item.href(encodedOrgSlug);
        const isActive = item.isActive(pathname, encodedOrgSlug);
        return (
          <Link
            key={item.key}
            href={href}
            className={`nav-item ${isActive ? "active" : ""}`}
            style={{ textDecoration: "none", display: "block" }}
          >
            <span className="nav-item-label">
              {item.icon}
              <span>{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
