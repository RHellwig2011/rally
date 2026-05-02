import { NextRequest } from "next/server";
import { createCsrfTokenEndpoint } from "@/lib/csrf";

/**
 * GET /api/csrf-token
 * Returns a CSRF token for the current session
 */
export const GET = createCsrfTokenEndpoint();
