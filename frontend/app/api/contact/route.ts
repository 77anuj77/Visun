import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Marketing contact endpoint.
 *
 * There is no configured inbox in this build. Messages are only delivered when
 * `CONTACT_WEBHOOK_URL` is set to a service that accepts JSON. Without it the
 * endpoint returns 503 and the UI says that nothing was sent, rather than
 * pretending a message was delivered.
 *
 * Protections: same-size JSON body, a honeypot field, and a small in-memory
 * rate limit per client IP. The rate limit is per server instance; it is a
 * best-effort guard, not a distributed quota.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_MESSAGE = 2000;
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

const inquiryTypes = new Set([
  "general",
  "sales",
  "technical",
  "feedback",
]);

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  const message = clean(body.message, MAX_MESSAGE + 1);

  const errors: Record<string, string> = {};
  if (fullName.length < 2) errors.fullName = "Enter your full name.";
  if (!emailPattern.test(email)) errors.email = "Enter a valid email address.";
  if (!inquiryTypes.has(inquiry)) errors.inquiry = "Choose an inquiry type.";
  if (message.length < 10) errors.message = "Add at least 10 characters.";
  if (message.length > MAX_MESSAGE) errors.message = "Keep the message under 2,000 characters.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { ok: false, error: "Check the highlighted fields.", fields: errors },
      { status: 400 },
    );
  }

  const webhookUrl = (process.env.CONTACT_WEBHOOK_URL ?? "").trim();
  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          "Contact delivery is not configured in this build. Nothing was sent.",
      },
      { status: 503 },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          "Contact delivery is misconfigured in this build. Nothing was sent.",
      },
      { status: 503 },
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          "Contact delivery is misconfigured in this build. Nothing was sent.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "visun-marketing/1.0",
      },
      body: JSON.stringify({
        source: "visun-marketing-contact",
        submittedAt: new Date().toISOString(),
        fullName,
        email,
        company: company || null,
        inquiry,
        message,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          error:
            "The contact service rejected the message. Nothing was confirmed.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, configured: true });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error:
          "The contact service could not be reached. Nothing was confirmed.",
      },
      { status: 502 },
    );
  }
}
