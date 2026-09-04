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

/** Friendly copy for the ?error= codes the OAuth callback redirects with. */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: "That sign-in option isn't available right now. Please use your email and password.",
  oauth_cancelled: "Sign-in was cancelled.",
  oauth_state_mismatch: "That sign-in link expired. Please try again.",
  oauth_unverified_email:
    "Your sign-in provider couldn't verify that email address, so we can't connect it to your existing account. Please sign in with your password instead.",
  oauth_failed: "Something went wrong during sign-in. Please try again.",
};

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
 * Where a signed-in user lands. `?redirect=` (or `?next=`) wins when it is a
 * same-site path; otherwise route by role. CAMPAIGN_LEADERs and everyone else
 * go to /campaigns, which is reachable whether or not they run a campaign yet.
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
  const [error, setError] = useState(() => {
    const code = searchParams?.get("error");
    return (code && OAUTH_ERROR_MESSAGES[code]) || "";
  });
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

      router.push(destinationFor(data.user?.role, searchParams?.get("redirect") ?? searchParams?.get("next") ?? null));
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* No opaque background here — the global Atmosphere (floodlights,
          grain) must show through; body carries the night background. */}
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
                  className="text-sm text-primary-300 hover:underline"
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

            <OAuthButtons redirect={searchParams?.get("redirect") ?? searchParams?.get("next") ?? undefined} />

            <div className="my-4 flex items-center gap-3 text-sm">
              <div className="h-px flex-1 bg-border" />
              <span className="text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="text-center text-sm">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary-300 font-semibold hover:underline">
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
