"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ClipboardList,
  BarChart3,
  ClipboardCheck,
  PenTool,
  Users,
  BookOpen,
  Heart,
} from "lucide-react";

const navItems = [
  { href: "/input", label: "Input", icon: ClipboardList },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/review", label: "Doctor Review", icon: ClipboardCheck },
  { href: "/signature", label: "Signature Setup", icon: PenTool },
  { href: "/admin/providers", label: "Providers", icon: Users },
  { href: "/admin/rules", label: "Auth Rules", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-blue-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-blue-800">
        <div className="flex items-center gap-2">
          <Heart className="w-8 h-8 text-red-400" />
          <div>
            <h1 className="text-xl font-bold">CardioAuth</h1>
            <p className="text-xs text-blue-300">MSW Heart Cardiology</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-700 text-white"
                  : "text-blue-200 hover:bg-blue-800 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blue-800">
        <div className="flex items-center gap-3 px-4">
          <UserButton afterSignOutUrl="/sign-in" />
          <span className="text-sm text-blue-300">Account</span>
        </div>
      </div>
    </aside>
  );
}
