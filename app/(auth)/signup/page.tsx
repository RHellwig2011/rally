"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/store/authStore";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

/**
 * Mirrors the role routing in app/(auth)/login/page.tsx. Kept in step by hand:
 * signup lands people in the same place a fresh sign-in would.
 *
 * `?redirect=` wins when it is a same-site path (e.g. a coach sent here from
 * the create-campaign wizard's sign-in gate must land back in the wizard).
 * Same isSameSitePath rule as the login page: "//evil.com" and backslash
 * variants resolve off-origin, so reject anything but a plain local path.
 */
function isSameSitePath(redirect: string) {
  return (
    redirect.startsWith("/") &&
    !redirect.startsWith("//") &&
    !redirect.includes("\\")
  );
}

function destinationFor(role: string | undefined, redirect: string | null) {
  if (redirect && isSameSitePath(redirect)) return redirect;
  if (role === "ADMIN" || role === "BANK_ADMIN") return "/admin";
  if (role === "PLAYER") return "/player";
  return "/campaigns";
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          role: "CAMPAIGN_LEADER", // Default role for new signups
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      // They just chose a password — making them type it again on a login
      // screen is a step for nothing. Sign them in with the same credentials
      // and only fall back to /login if that second call fails.
      try {
        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const loginData = await loginResponse.json();

        if (loginResponse.ok) {
          if (loginData.user) {
            setUser(loginData.user);
          }
          router.push(destinationFor(loginData.user?.role, searchParams?.get("redirect") ?? null));
          router.refresh();
          return;
        }
      } catch (loginErr) {
        console.error("Auto sign-in after signup failed:", loginErr);
      }

      // ?created=1 rather than a raw sentence in the query string; login owns
      // the copy. Preserve ?redirect= so the wizard gate round-trips.
      const redirect = searchParams?.get("redirect");
      router.push(
        `/login?created=1${redirect && isSameSitePath(redirect) ? `&redirect=${encodeURIComponent(redirect)}` : ""}`
      );
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-display font-bold text-xl">BB</span>
            </div>
          </div>
          <CardTitle className="font-display text-2xl font-semibold text-center">Create your account</CardTitle>
          <CardDescription className="text-center">
            For coaches and team parents. Players usually join from a link the
            coach sends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="bg-warning-light border border-warning text-warning-dark px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="coach@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <OAuthButtons redirect={searchParams?.get("redirect")} />

            <div className="text-center text-xs text-muted-foreground mt-4">
              By signing up, you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link
                href={`/login${searchParams?.get("redirect") ? `?redirect=${encodeURIComponent(searchParams.get("redirect")!)}` : ""}`}
                className="text-primary font-semibold hover:underline"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  // useSearchParams() needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
