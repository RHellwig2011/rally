"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/store/authStore";

/**
 * Is `redirect` a path on this site, and only this site?
 *
 * A leading "/" is not sufficient. "//evil.com" is a scheme-relative URL, and
 * browsers (plus Next's router) also normalise backslashes to forward slashes,
 * so "/\evil.com" and "/\/evil.com" resolve off-origin exactly the same way.
 * Reject any backslash anywhere rather than trying to enumerate the shapes.
 */
function isSameSitePath(redirect: string) {
  return (
    redirect.startsWith("/") &&
    !redirect.startsWith("//") &&
    !redirect.includes("\\")
  );
}

/**
 * Where a signed-in user lands. `?redirect=` wins when it is a same-site path;
 * otherwise route by role. CAMPAIGN_LEADERs and everyone else go to /campaigns,
 * which is reachable whether or not they run a campaign yet.
 */
function destinationFor(role: string | undefined, redirect: string | null) {
  if (redirect && isSameSitePath(redirect)) {
    return redirect;
  }
  if (role === "ADMIN" || role === "BANK_ADMIN") return "/admin";
  if (role === "PLAYER") return "/player";
  return "/campaigns";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams?.get("message");
  const created = searchParams?.get("created");
  // Signup normally signs people straight in; ?created=1 only survives when
  // that follow-up call failed, so the copy has to own the extra step.
  const successMessage = created
    ? "Welcome to Bleacher Backers. One more step: sign in with the password you just chose."
    : message;
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store user in Zustand store
      if (data.user) {
        setUser(data.user);
      }

      router.push(destinationFor(data.user?.role, searchParams?.get("redirect") ?? null));
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-display font-bold text-xl">BB</span>
            </div>
          </div>
          <CardTitle className="font-display text-2xl font-semibold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your Bleacher Backers account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {successMessage && (
              <div
                role="status"
                className="bg-success-light border border-success text-success-dark px-4 py-3 rounded-lg text-sm"
              >
                {successMessage}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="bg-warning-light border border-warning text-warning-dark px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="coach@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="text-center text-sm">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary font-semibold hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams() needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
