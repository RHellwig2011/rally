# Security Documentation

This document outlines the security measures implemented in the Rally fundraising platform.

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Security Headers](#security-headers)
4. [CSRF Protection](#csrf-protection)
5. [Rate Limiting](#rate-limiting)
6. [Input Validation](#input-validation)
7. [Payment Security](#payment-security)
8. [Testing Security](#testing-security)
9. [Security Checklist](#security-checklist)

---

## Overview

The Rally platform implements defense-in-depth security with multiple layers of protection:

- ✅ **Authentication:** JWT-based with refresh tokens
- ✅ **Authorization:** Role-based access control (RBAC)
- ✅ **CSRF Protection:** Double Submit Cookie pattern
- ✅ **Rate Limiting:** Per-endpoint configuration
- ✅ **Input Validation:** Zod schemas on all inputs
- ✅ **Security Headers:** OWASP recommended headers
- ✅ **Payment Security:** Stripe with webhook verification
- ✅ **Password Security:** Bcrypt hashing (12 rounds)

---

## Authentication & Authorization

### JWT Authentication

**Implementation:** `/lib/auth.ts`

```typescript
// Token Structure
{
  userId: string,
  email: string,
  role: 'USER' | 'CAMPAIGN_LEADER' | 'GUARDIAN' | 'BANK_ADMIN',
  iat: number,
  exp: number
}
```

**Token Lifecycle:**
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Secure, httpOnly cookies
- SameSite=strict for CSRF protection

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **USER** | View campaigns, make donations |
| **CAMPAIGN_LEADER** | Create campaigns, manage team members, request disbursements |
| **GUARDIAN** | Manage campaigns for minors, approve disbursements |
| **BANK_ADMIN** | Approve/reject disbursements, view platform analytics |

**Protected Routes:**
- `/dashboard/*` - Authenticated users only
- `/admin/*` - BANK_ADMIN only
- `/create-campaign` - CAMPAIGN_LEADER or GUARDIAN

---

## Security Headers

### Implemented Headers

All headers are configured in:
- `/lib/utils/security-headers.ts` (middleware)
- `/next.config.mjs` (Next.js config)

#### Content Security Policy (CSP)

Prevents XSS and code injection attacks.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://js.stripe.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://api.stripe.com;
  frame-src 'self' https://js.stripe.com;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```

**Why unsafe-inline for scripts/styles?**
- Next.js requires inline scripts for hydration
- Tailwind CSS uses inline styles
- Consider nonces in future for stricter CSP

#### HSTS (HTTP Strict Transport Security)

Forces HTTPS connections (production only).

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

- 2 years (63072000 seconds)
- Applies to all subdomains
- Eligible for browser preload list

#### X-Frame-Options

Prevents clickjacking attacks.

```
X-Frame-Options: DENY
```

Prevents Rally from being embedded in iframes.

#### X-Content-Type-Options

Prevents MIME type sniffing.

```
X-Content-Type-Options: nosniff
```

#### Referrer Policy

Controls referrer information sharing.

```
Referrer-Policy: strict-origin-when-cross-origin
```

#### Permissions Policy

Disables dangerous browser features.

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)
```

- Blocks camera access
- Blocks microphone access
- Blocks geolocation
- Blocks FLoC tracking
- Allows payment APIs on same origin

### Testing Security Headers

```bash
# Test headers on local server
npm run test:security

# Test headers on production
npm run test:security https://yourdomain.com

# Manual test with curl
curl -I http://localhost:3000 | grep -i "x-frame\|content-security\|strict-transport"
```

---

## CSRF Protection

### Implementation

**Files:**
- `/lib/csrf.ts` - Core CSRF utilities
- `/hooks/useCsrfToken.ts` - React hook
- `/app/api/csrf-token/route.ts` - Token endpoint

### How It Works

1. **Token Generation:**
   - 32-byte cryptographically secure random token
   - Stored in httpOnly cookie
   - Also returned to client

2. **Token Validation:**
   - Client sends token in `X-CSRF-Token` header
   - Server compares header token with cookie token
   - Uses SHA-256 hashing for timing-safe comparison

3. **Protected Methods:**
   - POST, PUT, PATCH, DELETE

4. **Exemptions:**
   - Webhooks (use signature verification instead)
   - Auth endpoints (special handling)

### Usage Example

```tsx
import { useCsrfToken, withCsrfToken } from '@/hooks/useCsrfToken';

function MyForm() {
  const { csrfToken, loading } = useCsrfToken();

  const handleSubmit = async () => {
    await fetch('/api/donations', withCsrfToken(csrfToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }));
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

### Protected Endpoints

- ✅ `/api/donations`
- ✅ `/api/campaigns`
- ✅ `/api/campaigns/[id]/team-members`
- ✅ `/api/admin/disbursements/[id]/approve`
- ✅ `/api/admin/disbursements/[id]/reject`

---

## Rate Limiting

### Implementation

**Files:**
- `/lib/utils/rate-limiter.ts` - Core rate limiter
- `/lib/utils/with-rate-limit.ts` - HOC wrapper

### Current Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| **Payment endpoints** | 10 requests | 1 hour |
| **Donation creation** | 20 requests | 1 hour |
| **Campaign creation** | 10 requests | 24 hours |
| **Campaign updates** | 50 requests | 1 hour |
| **CSV import** | 1 request | 1 hour |
| **Team member operations** | 100 requests | 1 hour |
| **General API** | 100 requests | 15 minutes |
| **Global (per IP)** | 300 requests | 15 minutes |

### Response Headers

Rate limit info is included in all API responses:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1234567890
```

On rate limit exceeded (429):

```
Retry-After: 3600
```

### Storage

**Current:** In-memory (per process)
- ✅ Simple, fast
- ⚠️ Resets on server restart
- ⚠️ Doesn't work across multiple servers

**Production Recommendation:** Redis/Vercel KV
- Distributed rate limiting
- Persistent across restarts
- Works with serverless/multi-instance

### Adding Rate Limiting

```typescript
import { checkRouteRateLimit } from '@/lib/utils/with-rate-limit';
import { RATE_LIMITS } from '@/lib/utils/rate-limiter';

export async function POST(req: NextRequest) {
  // Check rate limit
  const rateLimitCheck = checkRouteRateLimit(req, RATE_LIMITS.PAYMENT);
  if (rateLimitCheck.limited) {
    return rateLimitCheck.response!;
  }

  // Your endpoint logic
}
```

---

## Input Validation

### Zod Schemas

All user input is validated using Zod schemas.

**Location:** `/lib/validations/*.ts`

### Campaign Validation

```typescript
// Example: Campaign creation
{
  organizationName: string (2-100 chars)
  teamName: string (2-100 chars)
  slug: string (3-50 chars, lowercase, alphanumeric + hyphen)
  description: string (10-1000 chars)
  goalAmount: number ($1 - $100,000)
  startDate: ISO datetime (today or future)
  endDate: ISO datetime (after start date, max 1 year)
  category: enum (SPORTS, ARTS, EDUCATION, COMMUNITY, OTHER)
  primaryColor: hex color
  secondaryColor: hex color
}
```

### Donation Validation

```typescript
{
  campaignId: string (required)
  amount: number (positive, $1 - $50,000)
  donorEmail: email format
  donorName: string (optional)
  donorPhone: phone format (optional)
  message: string (optional, max 500 chars)
  isAnonymous: boolean
}
```

### SQL Injection Prevention

**Prisma ORM** - All database queries use parameterized statements
- No raw SQL (except for complex analytics)
- Automatic escaping of user input
- Type-safe queries

---

## Payment Security

### Stripe Integration

**Implementation:**
- `/lib/stripe.ts` - Stripe client
- `/app/api/webhooks/stripe/route.ts` - Webhook handler

### Security Measures

1. **Webhook Signature Verification**
   ```typescript
   const signature = req.headers.get("stripe-signature");
   const event = stripe.webhooks.constructEvent(
     body,
     signature,
     process.env.STRIPE_WEBHOOK_SECRET
   );
   ```

2. **Idempotency**
   - Payment intents are unique per donation
   - Duplicate webhooks are handled gracefully

3. **Amount Validation**
   - Server-side validation of all amounts
   - No client-side amount modification

4. **PCI Compliance**
   - Stripe.js handles card data
   - No card details touch Rally servers
   - PCI DSS Level 1 compliant (via Stripe)

### Test Mode

Development uses Stripe test mode:
```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

---

## Testing Security

### Running Tests

```bash
# Unit tests (including security tests)
npm test

# Security header validation
npm run test:security

# Test coverage
npm run test:coverage
```

### Security Test Coverage

- ✅ CSRF token generation and validation
- ✅ Rate limiting behavior
- ✅ Input validation (all endpoints)
- ✅ Authentication token verification
- ✅ Authorization (role-based access)
- ✅ Webhook signature validation

### Manual Security Testing

```bash
# Test CSRF protection
curl -X POST http://localhost:3000/api/donations \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'
# Should return: 403 Invalid CSRF token

# Test rate limiting
for i in {1..15}; do
  curl http://localhost:3000/api/donations
done
# Should return: 429 Too many requests

# Test security headers
curl -I http://localhost:3000
```

---

## Security Checklist

### Implemented ✅

- [x] JWT authentication with refresh tokens
- [x] Password hashing (bcrypt, 12 rounds)
- [x] Role-based access control (RBAC)
- [x] CSRF protection (Double Submit Cookie)
- [x] Rate limiting (per-endpoint configuration)
- [x] Input validation (Zod schemas)
- [x] SQL injection prevention (Prisma ORM)
- [x] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] Stripe webhook signature verification
- [x] Secure session cookies (httpOnly, secure, sameSite)
- [x] XSS prevention (CSP, output encoding)
- [x] Clickjacking prevention (X-Frame-Options, CSP)

### Pending ⏳

- [ ] Security audit by professional firm
- [ ] Penetration testing
- [ ] Dependency vulnerability scanning (Dependabot)
- [ ] Secrets management (production)
- [ ] DDoS protection (via hosting provider)
- [ ] WAF (Web Application Firewall)
- [ ] Log monitoring and alerting
- [ ] Incident response plan
- [ ] Data encryption at rest
- [ ] Regular security updates

### Production Requirements 📋

1. **Environment Variables**
   - Move secrets to secure vault (AWS Secrets Manager, etc.)
   - Rotate keys regularly
   - Use different keys for staging/production

2. **HTTPS**
   - SSL/TLS certificates
   - Automatic HTTPS redirect
   - Certificate renewal automation

3. **Monitoring**
   - Error tracking (Sentry)
   - Security event logging
   - Failed authentication alerts
   - Rate limit breach notifications

4. **Backups**
   - Automated database backups
   - Backup encryption
   - Regular restore testing
   - Point-in-time recovery

5. **Compliance**
   - GDPR compliance (data privacy)
   - PCI DSS (via Stripe)
   - SOC 2 (future consideration)
   - Privacy policy
   - Terms of service

---

## Reporting Security Issues

**Do NOT open public issues for security vulnerabilities.**

Please report security issues privately:

1. Email: security@rally-platform.com (set this up)
2. Expected response time: 48 hours
3. We follow responsible disclosure

### Vulnerability Disclosure Policy

- We acknowledge receipt within 48 hours
- We provide status updates every 7 days
- We credit researchers (with permission)
- We fix critical issues within 7 days
- We fix high-severity issues within 30 days

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [Stripe Security](https://stripe.com/docs/security)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)

---

**Last Updated:** November 26, 2025
**Version:** 1.0
**Maintained by:** Rally Development Team
