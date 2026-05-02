/**
 * Security Headers Configuration
 * Comprehensive security headers for production deployment
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  strictTransportSecurity?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: string;
  referrerPolicy?: string;
  permissionsPolicy?: string;
  xXSSProtection?: string;
  xDNSPrefetchControl?: string;
}

/**
 * Content Security Policy (CSP)
 * Protects against XSS, clickjacking, and other code injection attacks
 */
export function getContentSecurityPolicy(isDevelopment = false): string {
  const directives = {
    // Default fallback for all resource types
    "default-src": ["'self'"],

    // Scripts: Allow self and Stripe
    "script-src": [
      "'self'",
      isDevelopment ? "'unsafe-eval'" : "", // Next.js dev mode needs eval
      "'unsafe-inline'", // Required for Next.js and some libraries
      "https://js.stripe.com",
      "https://maps.googleapis.com",
    ].filter(Boolean),

    // Styles: Allow self and inline styles (for Tailwind)
    "style-src": [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind and inline styles
      "https://fonts.googleapis.com",
    ],

    // Images: Allow self, data URIs, and common CDNs
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https:",
      "https://*.stripe.com",
    ],

    // Fonts: Allow self and Google Fonts
    "font-src": [
      "'self'",
      "data:",
      "https://fonts.gstatic.com",
    ],

    // Connect (AJAX, WebSocket, etc.): Allow self and Stripe
    "connect-src": [
      "'self'",
      "https://api.stripe.com",
      "https://*.stripe.com",
      isDevelopment ? "ws://localhost:*" : "", // Next.js dev mode WebSocket
      isDevelopment ? "http://localhost:*" : "",
    ].filter(Boolean),

    // Frames: Only allow Stripe for payment forms
    "frame-src": [
      "'self'",
      "https://js.stripe.com",
      "https://hooks.stripe.com",
    ],

    // Objects: Disallow plugins
    "object-src": ["'none'"],

    // Base URI: Restrict to same origin
    "base-uri": ["'self'"],

    // Form actions: Only allow same origin
    "form-action": ["'self'"],

    // Frame ancestors: Prevent embedding (clickjacking protection)
    "frame-ancestors": ["'none'"],

    // Upgrade insecure requests in production
    ...(isDevelopment ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([key, values]) => {
      const value = Array.isArray(values) ? values.join(" ") : values;
      return value ? `${key} ${value}` : key;
    })
    .join("; ");
}

/**
 * Get all security headers
 */
export function getSecurityHeaders(isDevelopment = false): Record<string, string> {
  return {
    // Content Security Policy
    "Content-Security-Policy": getContentSecurityPolicy(isDevelopment),

    // Strict Transport Security (HSTS)
    // Force HTTPS for 2 years, include subdomains
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",

    // Prevent clickjacking attacks
    "X-Frame-Options": "DENY",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Referrer Policy - Send origin only on cross-origin requests
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy (formerly Feature-Policy)
    // Disable dangerous features
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()", // Disable FLoC
      "payment=(self)", // Allow payment APIs only on same origin
    ].join(", "),

    // XSS Protection (legacy, but still good to have)
    "X-XSS-Protection": "1; mode=block",

    // DNS Prefetch Control
    "X-DNS-Prefetch-Control": "on",

    // Don't send server info
    "X-Powered-By": "Rally",
  };
}

/**
 * Apply security headers to Next.js response
 */
export function applySecurityHeaders(
  headers: Headers,
  isDevelopment = false
): void {
  const securityHeaders = getSecurityHeaders(isDevelopment);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
}

/**
 * Get security headers for Next.js config
 * Used in next.config.js
 */
export function getNextConfigHeaders(isDevelopment = false) {
  const headers = getSecurityHeaders(isDevelopment);

  return Object.entries(headers).map(([key, value]) => ({
    key,
    value,
  }));
}
