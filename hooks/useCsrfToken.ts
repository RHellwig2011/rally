"use client";

import { useState, useEffect } from "react";

/**
 * React hook to fetch and manage CSRF tokens
 * Usage:
 * ```tsx
 * const { csrfToken, loading, error } = useCsrfToken();
 *
 * // In fetch request:
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-CSRF-Token': csrfToken,
 *   },
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCsrfToken() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/csrf-token", {
          method: "GET",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch CSRF token");
        }

        const data = await response.json();

        if (data.success && data.csrfToken) {
          setCsrfToken(data.csrfToken);
        } else {
          throw new Error("Invalid CSRF token response");
        }
      } catch (err) {
        console.error("Error fetching CSRF token:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch CSRF token");
      } finally {
        setLoading(false);
      }
    }

    fetchCsrfToken();
  }, []);

  return { csrfToken, loading, error };
}

/**
 * Helper function to add CSRF token to fetch options
 */
export function withCsrfToken(
  csrfToken: string,
  options: RequestInit = {}
): RequestInit {
  return {
    ...options,
    headers: {
      ...options.headers,
      "X-CSRF-Token": csrfToken,
    },
  };
}
