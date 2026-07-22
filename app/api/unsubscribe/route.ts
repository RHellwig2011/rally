import { NextRequest, NextResponse } from "next/server";
import {
  verifyUnsubscribeToken,
  recordOptOut,
  type SuppressionChannel,
} from "@/lib/suppression";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/unsubscribe?token=...
 *
 * Tokenized, no-login unsubscribe. The token is an HMAC of
 * "<email>:<channel>" keyed with JWT_SECRET, so possession of a valid token IS
 * the authorization — there is no session and no CSRF token to present.
 *
 * DELIBERATE CSRF EXEMPTION: this route does NOT call checkCsrf(). RFC 8058
 * one-click unsubscribe requires mailbox providers (Gmail, Yahoo) to POST here
 * directly with no cookies and no headers of ours. The HMAC token is the
 * defense; the worst a forged request can do is unsubscribe an address the
 * attacker already had a signed token for. Same rationale as /api/webhooks/*.
 *
 * The link never expires. CAN-SPAM requires opt-out mechanisms to work for at
 * least 30 days after send; indefinite validity is simpler and strictly safer.
 */

function page(title: string, body: string, status: number): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:64px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px 32px;text-align:center;">
      ${body}
    </div>
    <p style="margin:24px 0 0;text-align:center;font-size:12px;color:#9ca3af;">
      Bleacher Backers
    </p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function invalidTokenPage(): NextResponse {
  return page(
    "Invalid unsubscribe link",
    `<h1 style="margin:0 0 12px;font-size:22px;color:#111827;">This link isn't valid</h1>
     <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
       The unsubscribe link appears to be incomplete or altered. Please use the
       link exactly as it appears in your email, or reply to that email and
       we'll remove you manually.
     </p>`,
    400
  );
}

function channelLabel(channel: SuppressionChannel): string {
  if (channel === "EMAIL") return "emails";
  if (channel === "SMS") return "text messages";
  return "emails and text messages";
}

/**
 * GET — render the confirmation page. Intentionally does NOT record the
 * opt-out: mailbox scanners and link prefetchers follow GET links, and
 * silently unsubscribing someone because their security appliance crawled
 * the email would be worse than useless.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const verified = verifyUnsubscribeToken(token);

  if (!verified) {
    return invalidTokenPage();
  }

  const escapedEmail = verified.email.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const escapedToken = (token || "").replace(/"/g, "&quot;");

  return page(
    "Unsubscribe",
    `<h1 style="margin:0 0 12px;font-size:22px;color:#111827;">Unsubscribe</h1>
     <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
       Stop sending ${channelLabel(verified.channel)} to
       <strong style="color:#111827;">${escapedEmail}</strong>?
     </p>
     <form method="POST" action="/api/unsubscribe">
       <input type="hidden" name="token" value="${escapedToken}">
       <button type="submit" style="display:inline-block;background:#dc2626;color:#ffffff;border:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">
         Yes, unsubscribe me
       </button>
     </form>
     <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
       You'll still receive essential messages like donation receipts and
       account security emails.
     </p>`,
    200
  );
}

/**
 * POST — record the opt-out. Accepts the token from the query string, a form
 * post (the confirmation page above), or a JSON body. RFC 8058 one-click
 * clients POST to the List-Unsubscribe URL with the token already in the query
 * string, so that path must work with an empty body.
 */
export async function POST(request: NextRequest) {
  try {
    let token = request.nextUrl.searchParams.get("token");

    if (!token) {
      const contentType = request.headers.get("content-type") || "";
      try {
        if (contentType.includes("application/json")) {
          const body = await request.json();
          token = typeof body?.token === "string" ? body.token : null;
        } else if (
          contentType.includes("application/x-www-form-urlencoded") ||
          contentType.includes("multipart/form-data")
        ) {
          const form = await request.formData();
          const value = form.get("token");
          token = typeof value === "string" ? value : null;
        }
      } catch {
        // Empty or unparseable body — one-click clients send no body at all.
        token = null;
      }
    }

    const verified = verifyUnsubscribeToken(token);

    if (!verified) {
      const wantsJson = (request.headers.get("accept") || "").includes("application/json");
      if (wantsJson) {
        return NextResponse.json(
          { success: false, error: "Invalid or malformed unsubscribe token" },
          { status: 400 }
        );
      }
      return invalidTokenPage();
    }

    const result = await recordOptOut({
      email: verified.email,
      channel: verified.channel,
      source: "UNSUBSCRIBE_LINK",
      note: "Self-service unsubscribe link",
    });

    console.log(
      `🔕 Unsubscribe recorded (${verified.channel}) — created=${result.created}`
    );

    const wantsJson = (request.headers.get("accept") || "").includes("application/json");
    if (wantsJson) {
      return NextResponse.json({
        success: true,
        email: verified.email,
        channel: verified.channel,
        alreadyUnsubscribed: !result.created,
      });
    }

    const escapedEmail = verified.email.replace(/&/g, "&amp;").replace(/</g, "&lt;");

    return page(
      "You're unsubscribed",
      `<div style="font-size:40px;line-height:1;margin-bottom:16px;">✅</div>
       <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">You're unsubscribed</h1>
       <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
         We've stopped sending ${channelLabel(verified.channel)} to
         <strong style="color:#111827;">${escapedEmail}</strong>.
       </p>
       <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
         You'll still receive essential messages like donation receipts and
         account security emails.
       </p>`,
      200
    );
  } catch (error) {
    console.error("Error recording unsubscribe:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record unsubscribe" },
      { status: 500 }
    );
  }
}
