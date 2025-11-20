"use client";

import Link from "next/link";
import { useEffect } from "react";
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
import { User, LogOut, LayoutDashboard } from "lucide-react";

export function Navigation() {
  const { user, isAuthenticated, checkAuth, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Rally</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-600 hover:text-gray-900">
              Features
            </Link>
            <Link href="#pricing" className="text-gray-600 hover:text-gray-900">
              Pricing
            </Link>

            {isAuthenticated && user ? (
              <>
                <Link
                  href="/create-campaign"
                  className="text-gray-600 hover:text-gray-900"
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
                        <span className="text-xs text-gray-500 font-normal">
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
                      className="cursor-pointer text-red-600"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-gray-900">
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

          {/* Mobile menu button - can be enhanced later */}
          <div className="md:hidden">
            <Link
              href={isAuthenticated ? "/dashboard" : "/signup"}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm"
            >
              {isAuthenticated ? "Dashboard" : "Sign Up"}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
