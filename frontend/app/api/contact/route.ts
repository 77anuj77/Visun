import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

/**
 * Public installation-request endpoint.
 *
 * Delivers one notification email through Resend. The browser never sees the
 * API key, and success is only reported after Resend accepts the message.
 * Protections: a body-size limit, a honeypot field, a small in-memory rate limit
 * per client IP, and duplicate suppression within a short window. The in-memory
 * guards are per server instance: best-effort protection, not a distributed
 * quota.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_MESSAGE = 2000;
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED_SUBMISSIONS = 500;

const inquiryLabels = {
  personal: "Personal Setup",
  studio: "Studio / Business Setup",
  general: "General Inquiry",
  technical: "Technical Support",
} as const;

const installationLabels = {
  computer: "Personal Computer",
  server: "Private Server / VPS",
  unsure: "Need Help Deciding",
} as const;

const osLabels = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  unsure: "Not Sure",
} as const;

type InquiryType = keyof typeof inquiryLabels;
type InstallationType = keyof typeof installationLabels;
type OsType = keyof typeof osLabels;

const inquiryTypes = new Set<string>(Object.keys(inquiryLabels));
const installationTypes = new Set<string>(Object.keys(installationLabels));
const operatingSystems = new Set<string>(Object.keys(osLabels));

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const recentSubmissions = new Map<string, number>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return ip;
}

function rateLimit(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfter: 0 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      limited: true,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { limited: false, retryAfter: 0 };
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function extractEmail(value: string) {
  const match = value.match(/<([^<>]+)>/);
  return (match?.[1] ?? value).trim();
}

function pruneRecentSubmissions(now: number) {
  for (const [key, at] of recentSubmissions) {
    if (now - at >= DUPLICATE_WINDOW_MS) recentSubmissions.delete(key);
  }
  while (recentSubmissions.size > MAX_TRACKED_SUBMISSIONS) {
    const oldest = recentSubmissions.keys().next().value;
    if (oldest === undefined) break;
    recentSubmissions.delete(oldest);
  }
}

function formatSubmittedAt(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  }).format(date);
}

function buildEmail({
  fullName,
  email,
  company,
  inquiry,
  installation,
  os,
  message,
  submittedAt,
  submittedIso,
}: {
  fullName: string;
  email: string;
  company: string;
  inquiry: InquiryType;
  installation: InstallationType;
  os: OsType;
  message: string;
  submittedAt: string;
  submittedIso: string;
}) {
  const label = inquiryLabels[inquiry];
  const installationLabel = installationLabels[installation];
  const osLabel = osLabels[os];
  const safeName = escapeHtml(fullName);
  const safeEmail = escapeHtml(email);
  const safeCompany = escapeHtml(company || "Not provided");
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");
  const safeSubmittedAt = escapeHtml(submittedAt);

  const text = [
    "New Visun installation request",
    "",
    `Inquiry type: ${label}`,
    `Full name: ${fullName}`,
    `Email: ${email}`,
    `Company / workspace: ${company || "Not provided"}`,
    `Preferred installation: ${installationLabel}`,
    `Operating system: ${osLabel}`,
    `Submitted: ${submittedAt} (${submittedIso})`,
    "",
    "Message:",
    message,
    "",
    "Reply directly to this email to respond to the visitor.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New Visun installation request</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f2ec;color:#17150f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Installation request from ${safeName}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e4ded3;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background-color:#17150f;padding:22px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#ff5a00;border-radius:8px;color:#17150f;font-size:15px;font-weight:800;">V</span>
                      <span style="margin-left:10px;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.08em;">VISUN</span>
                    </td>
                    <td align="right" style="color:#b9b1a4;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;">Installation request</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 8px;">
                <p style="margin:0 0 6px;color:#8f8a80;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(label)}</p>
                <h1 style="margin:0;color:#17150f;font-size:24px;line-height:1.25;font-weight:700;">New request from ${safeName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 6px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ece6dc;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="width:170px;padding:11px 14px;background-color:#faf8f4;border-bottom:1px solid #ece6dc;color:#8f8a80;font-size:11px;font-weight:600;">Full name</td>
                    <td style="padding:11px 14px;border-bottom:1px solid #ece6dc;font-size:12px;">${safeName}</td>
                  </tr>
                  <tr>
                    <td style="padding:11px 14px;background-color:#faf8f4;border-bottom:1px solid #ece6dc;color:#8f8a80;font-size:11px;font-weight:600;">Email</td>
                    <td style="padding:11px 14px;border-bottom:1px solid #ece6dc;font-size:12px;">${safeEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:11px 14px;background-color:#faf8f4;border-bottom:1px solid #ece6dc;color:#8f8a80;font-size:11px;font-weight:600;">Company / workspace</td>
                    <td style="padding:11px 14px;border-bottom:1px solid #ece6dc;font-size:12px;">${safeCompany}</td>
                  </tr>
                  <tr>
                    <td style="padding:11px 14px;background-color:#faf8f4;border-bottom:1px solid #ece6dc;color:#8f8a80;font-size:11px;font-weight:600;">Inquiry type</td>
                    <td style="padding:11px 14px;border-bottom:1px solid #ece6dc;font-size:12px;">${escapeHtml(label)}</td>
                  </tr>
                  <tr>
                    <td style="padding:11px 14px;background-color:#faf8f4;border-bottom:1px solid #ece6dc;color:#8f8a80;font-size:11px;font-weight:600;">Preferred installation</td>
                    <td style="padding:11px 14px;border-bottom:1px solid #ece6dc;font-size:12px;">${escapeHtml(installationLabel)}</td>
                  </tr>
                  <tr>
                    <td style="padding:11px 14px;background-color:#faf8f4;border-bottom:1px solid #ece6dc;color:#8f8a80;font-size:11px;font-weight:600;">Operating system</td>
                    <td style="padding:11px 14px;border-bottom:1px solid #ece6dc;font-size:12px;">${escapeHtml(osLabel)}</td>
                  </tr>
                  <tr>
                    <td style="padding:11px 14px;background-color:#faf8f4;color:#8f8a80;font-size:11px;font-weight:600;">Submitted</td>
                    <td style="padding:11px 14px;font-size:12px;">${safeSubmittedAt}<br /><span style="color:#8f8a80;font-size:11px;">${escapeHtml(submittedIso)}</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 6px;">
                <p style="margin:0 0 8px;color:#8f8a80;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;">Message</p>
                <div style="padding:16px 18px;background-color:#faf8f4;border:1px solid #ece6dc;border-radius:12px;font-size:13px;line-height:1.65;color:#33302a;">${safeMessage}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 30px;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#8f8a80;">Sent from the Visun contact form. Reply directly to this email to reach ${safeName} at ${safeEmail}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { label, html, text };
}

export async function POST(request: Request) {
  if (!/application\/json/i.test(request.headers.get("content-type") ?? "")) {
    return NextResponse.json(
      { ok: false, error: "Expected a JSON request body." },
      { status: 415 },
    );
  }

  const key = clientKey(request);
  const limit = rateLimit(key);
  if (limit.limited) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many messages from this connection. Try again shortly.",
      },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfter) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Message is too large." },
        { status: 413 },
      );
    }
    body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: "Expected a JSON object." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed JSON." },
      { status: 400 },
    );
  }

  // Honeypot: a real visitor never fills this hidden field.
  if (clean(body.website, 120).length > 0) {
    return NextResponse.json({ ok: true });
  }

  const fullName = clean(body.fullName, 100);
  const email = clean(body.email, 200);
  const company = clean(body.company, 120);
  const inquiry = clean(body.inquiry, 40).toLowerCase();
  const installation = clean(body.installation, 40).toLowerCase();
  const os = clean(body.os, 40).toLowerCase();
  const message = clean(body.message, MAX_MESSAGE + 1);

  const errors: Record<string, string> = {};
  if (fullName.length < 2) errors.fullName = "Enter your full name.";
  if (!emailPattern.test(email)) errors.email = "Enter a valid email address.";
  if (!inquiryTypes.has(inquiry)) errors.inquiry = "Choose an inquiry type.";
  if (!installationTypes.has(installation)) {
    errors.installation = "Choose a preferred installation type.";
  }
  if (!operatingSystems.has(os)) errors.os = "Choose an operating system.";
  if (message.length < 10) errors.message = "Add at least 10 characters.";
  if (message.length > MAX_MESSAGE) {
    errors.message = "Keep the message under 2,000 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { ok: false, error: "Check the highlighted fields.", fields: errors },
      { status: 400 },
    );
  }

  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const to = (process.env.CONTACT_TO_EMAIL ?? "").trim();
  const from =
    (process.env.CONTACT_FROM_EMAIL ?? "").trim() ||
    "Visun <onboarding@resend.dev>";

  if (
    !apiKey ||
    !emailPattern.test(to) ||
    !emailPattern.test(extractEmail(from)) ||
    /[\r\n]/.test(from)
  ) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          "Contact delivery is not configured in this installation. Nothing was sent.",
      },
      { status: 503 },
    );
  }

  const now = Date.now();
  pruneRecentSubmissions(now);
  const dedupeKey = `${email.toLowerCase()}\u0000${inquiry}\u0000${installation}\u0000${os}\u0000${message}`;
  if (recentSubmissions.has(dedupeKey)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This message was already sent recently. Please wait a few minutes before sending it again.",
      },
      { status: 409 },
    );
  }

  const submittedAt = new Date();
  const submittedIso = submittedAt.toISOString();
  const submittedLabel = formatSubmittedAt(submittedAt);
  const inquiryType = inquiry as InquiryType;
  const installationType = installation as InstallationType;
  const osType = os as OsType;
  const { label, html, text } = buildEmail({
    fullName,
    email,
    company,
    inquiry: inquiryType,
    installation: installationType,
    os: osType,
    message,
    submittedAt: submittedLabel,
    submittedIso,
  });

  const isInstallation =
    inquiryType === "personal" || inquiryType === "studio";
  const subject = isInstallation
    ? `New Visun Installation Request — ${label}`
    : `New Visun Inquiry — ${label}`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(
      {
        from,
        to: [to],
        replyTo: email,
        subject,
        html,
        text,
      },
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );

    if (error || !data?.id) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          error:
            "The email service rejected the message. Nothing was confirmed.",
        },
        { status: 502 },
      );
    }

    recentSubmissions.set(dedupeKey, now);
    return NextResponse.json({ ok: true, configured: true });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error:
          "The email service could not be reached. Nothing was confirmed.",
      },
      { status: 502 },
    );
  }
}
