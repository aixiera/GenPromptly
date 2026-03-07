import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/classic(.*)", "/api(.*)"]);
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/api/templates(.*)",
]);

type ProxyRateCounter = {
  count: number;
  resetAtMs: number;
};

const proxyGlobal = globalThis as unknown as {
  __genPromptlyProxyRateCounters?: Map<string, ProxyRateCounter>;
};

const proxyRateCounters = proxyGlobal.__genPromptlyProxyRateCounters ?? new Map<string, ProxyRateCounter>();
proxyGlobal.__genPromptlyProxyRateCounters = proxyRateCounters;

const PUBLIC_BURST_WINDOW_MS = 60_000;
const PUBLIC_BURST_MAX = 120;

function sanitizeProxyIp(raw: string | null): string {
  if (!raw) {
    return "unknown";
  }
  const token = raw.split(",")[0]?.trim() ?? "";
  if (!token) {
    return "unknown";
  }
  return token.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 80) || "unknown";
}

function consumeProxyRateToken(key: string, windowMs: number, maxRequests: number): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const entry = proxyRateCounters.get(key);
  if (!entry || entry.resetAtMs <= now) {
    proxyRateCounters.set(key, { count: 1, resetAtMs: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAtMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  entry.count += 1;
  proxyRateCounters.set(key, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}

function isPublicBurstSensitivePath(pathname: string): boolean {
  return pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up") || pathname.startsWith("/invite");
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  if (isPublicBurstSensitivePath(pathname)) {
    const ip = sanitizeProxyIp(req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"));
    const key = `proxy:${pathname}:${ip}`;
    const decision = consumeProxyRateToken(key, PUBLIC_BURST_WINDOW_MS, PUBLIC_BURST_MAX);
    if (!decision.allowed) {
      const message = "Too many requests. Please wait before retrying.";
      const response = new NextResponse(message, { status: 429 });
      response.headers.set("Retry-After", String(decision.retryAfterSeconds));
      return response;
    }
  }

  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api|trpc)(.*)",
  ],
};
