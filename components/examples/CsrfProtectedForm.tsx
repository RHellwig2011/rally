"use client";

import { useState, FormEvent } from "react";
import { useCsrfToken, withCsrfToken } from "@/hooks/useCsrfToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Example component demonstrating CSRF-protected form submission
 *
 * Usage in other components:
 * 1. Import the useCsrfToken hook
 * 2. Get the csrfToken
 * 3. Include it in the X-CSRF-Token header
 */
export default function CsrfProtectedForm() {
  const { csrfToken, loading, error } = useCsrfToken();
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!csrfToken) {
      setResult("Error: CSRF token not available");
      return;
    }

    try {
      setSubmitting(true);
      setResult(null);

      // Method 1: Using withCsrfToken helper
      const response = await fetch("/api/some-endpoint", withCsrfToken(csrfToken, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }));

      /* Method 2: Manual header addition
      const response = await fetch("/api/some-endpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(formData),
      });
      */

      const data = await response.json();

      if (response.ok && data.success) {
        setResult("Success!");
      } else {
        setResult(`Error: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Request failed"}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div>Loading CSRF protection...</div>;
  }

  if (error) {
    return <div className="text-destructive">Error loading CSRF token: {error}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      <Button type="submit" disabled={submitting || !csrfToken}>
        {submitting ? "Submitting..." : "Submit"}
      </Button>

      {result && (
        <div
          className={`mt-4 p-3 rounded ${
            result.startsWith("Success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {result}
        </div>
      )}
    </form>
  );
}
