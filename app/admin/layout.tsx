"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  FileCheck,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/authStore";

const navigation = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Campaigns", href: "/admin/campaigns", icon: TrendingUp },
  { name: "Transactions", href: "/admin/transactions", icon: Wallet },
  { name: "Disbursements", href: "/admin/disbursements", icon: FileCheck },
  { name: "Users", href: "/admin/users", icon: Users },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasHydrated, checkAuth, logout } = useAuthStore();

  // False during SSR and the first client render; flips after mount. Combined
  // with hasHydrated so the first client render matches the server-rendered
  // markup and React does not report a hydration mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Fallback: if persist's onRehydrateStorage never fired (e.g. storage
    // unavailable), unblock the auth-dependent UI once we're mounted.
    if (!useAuthStore.getState().hasHydrated) {
      useAuthStore.getState().setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  const showUser = mounted && hasHydrated && user;
  const fullName = showUser ? `${user.firstName} ${user.lastName}`.trim() : "";
  const initials = showUser
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <div className="min-h-screen bg-muted">
      {/* Top Navigation Bar */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/admin" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Rally</span>
              <span className="text-sm bg-primary-100 text-primary px-2 py-1 rounded-full font-semibold ml-2">
                Admin
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/settings" aria-label="Platform settings">
                  <Settings className="w-4 h-4" />
                </Link>
              </Button>
              {showUser && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold text-sm">{initials}</span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-foreground">{fullName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="hidden md:flex md:flex-col w-64 border-r bg-white min-h-[calc(100vh-4rem)]">
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
