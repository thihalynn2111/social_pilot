"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Queue" },
  { href: "/new", label: "New post" },
  { href: "/accounts", label: "Accounts" },
];

export default function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Main">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "on" : ""} aria-current={path === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
