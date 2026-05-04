import { NextResponse, type NextRequest } from "next/server";

/**
 * Generate a per-request CSP nonce + apply a strict CSP that doesn't rely on
 * `'unsafe-inline'` for scripts. Inline scripts emitted by Next.js will pick
 * up the nonce automatically via the `x-nonce` request header convention.
 *
 * Why middleware (not next.config.js): a static CSP can't reference a fresh
 * per-request nonce, so it has to fall back to `'unsafe-inline'`, which
 * defeats most of CSP's XSS protection.
 *
 * Reference: https://nextjs.org/docs/app/guides/content-security-policy
 */
export function middleware(request: NextRequest) {
  // Skip API routes — they don't render HTML, so CSP is irrelevant and we
  // don't want to pay the per-request cost.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' lets the nonce'd script load further scripts without
    // needing to enumerate every CDN. In dev, Next.js's HMR client uses eval,
    // so we relax with 'unsafe-eval'.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind/shadcn need inline styles. There's no good way around this
    // until browsers ship style nonces broadly.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    // Composio logo CDN + OAuth dance happens client-side. Keep it scoped.
    `connect-src 'self' *.composio.dev`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  // Forward the nonce to the rendering layer so layouts/components can read
  // it via `headers().get("x-nonce")` if they need to inline a script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on every page request except Next internals + static assets.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$).*)",
    },
  ],
};
