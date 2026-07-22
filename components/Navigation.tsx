"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, LayoutDashboard, Menu, X } from "lucide-react";

export function Navigation() {
  const { user, isAuthenticated, hasHydrated, checkAuth, logout } = useAuthStore();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // False during SSR and the first client render; flips after mount. Combined
  // with hasHydrated below so the first client render always matches the
  // server-rendered (logged-out) markup — no React hydration mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Fallback: if persist's onRehydrateStorage never fired (e.g. storage
    // unavailable), unblock auth-dependent UI once we're mounted.
    if (!useAuthStore.getState().hasHydrated) {
      useAuthStore.getState().setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Render the logged-out variant until the store has rehydrated and the
  // component has mounted on the client.
  const showAuthenticated = mounted && hasHydrated && isAuthenticated;

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">BB</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="/campaigns" className="text-muted-foreground hover:text-foreground">
              Browse Campaigns
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>

            {showAuthenticated && user ? (
              <>
                <Link
                  href="/create-campaign"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Create Campaign
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {user.firstName}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {user.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(user.role === "CAMPAIGN_LEADER" || user.role === "GUARDIAN") && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center cursor-pointer">
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          My Campaigns
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {user.role === "TEAM_MEMBER" && (
                      <DropdownMenuItem asChild>
                        <Link href="/player" className="flex items-center cursor-pointer">
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          My Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {user.role === "BANK_ADMIN" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center cursor-pointer">
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer text-warning"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/login" className="text-muted-foreground hover:text-foreground">
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="h-11 w-11 p-0"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />

          {/* Mobile Menu Panel */}
          <div className="fixed top-16 inset-x-0 bottom-0 bg-white z-40 md:hidden overflow-y-auto">
            <div className="px-4 py-6 space-y-1">
              {/* Navigation Links */}
              <Link
                href="#features"
                onClick={closeMobileMenu}
                className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
              >
                Features
              </Link>
              <Link
                href="/campaigns"
                onClick={closeMobileMenu}
                className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
              >
                Browse Campaigns
              </Link>
              <Link
                href="#pricing"
                onClick={closeMobileMenu}
                className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
              >
                Pricing
              </Link>

              {showAuthenticated && user ? (
                <>
                  <div className="border-t border-border my-4" />

                  <Link
                    href="/create-campaign"
                    onClick={closeMobileMenu}
                    className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
                  >
                    Create Campaign
                  </Link>

                  {/* User Info Section */}
                  <div className="px-4 py-3 bg-muted rounded-lg">
                    <p className="text-sm font-semibold text-foreground">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>

                  {/* Dashboard Links */}
                  {(user.role === "CAMPAIGN_LEADER" || user.role === "GUARDIAN") && (
                    <Link
                      href="/dashboard"
                      onClick={closeMobileMenu}
                      className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
                    >
                      <LayoutDashboard className="w-5 h-5 mr-3" />
                      My Campaigns
                    </Link>
                  )}
                  {user.role === "TEAM_MEMBER" && (
                    <Link
                      href="/player"
                      onClick={closeMobileMenu}
                      className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
                    >
                      <LayoutDashboard className="w-5 h-5 mr-3" />
                      My Dashboard
                    </Link>
                  )}
                  {user.role === "BANK_ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={closeMobileMenu}
                      className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
                    >
                      <LayoutDashboard className="w-5 h-5 mr-3" />
                      Admin Panel
                    </Link>
                  )}

                  <div className="border-t border-border my-4" />

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-base font-medium text-warning hover:bg-warning-light rounded-lg min-h-[48px] flex items-center"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <div className="border-t border-border my-4" />

                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted hover:text-foreground rounded-lg min-h-[48px] flex items-center"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={closeMobileMenu}
                    className="block px-4 py-3 text-base font-medium text-white bg-primary hover:bg-primary/90 rounded-lg min-h-[48px] flex items-center justify-center"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
