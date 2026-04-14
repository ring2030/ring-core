import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";

function getSession(request: NextRequest) {
  const raw = request.cookies.get(getSessionCookieName())?.value;
  return raw ? verifySessionToken(raw) : null;
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  const login = new URL("/login", request.url);
  const next = `${url.pathname}${url.search}`;
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = getSession(request);

  if (
    path === "/dashboard" ||
    path.startsWith("/dashboard/nurse") ||
    path.startsWith("/settings")
  ) {
    if (!session || session.role !== "nurse") return redirectToLogin(request);
  }

  if (path.startsWith("/dashboard/family") || path.startsWith("/dashboard/history")) {
    if (!session || (session.role !== "family" && session.role !== "nurse")) {
      return redirectToLogin(request);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/kiyoko/:path*", "/settings/:path*", "/dashboard/:path*"],
};
