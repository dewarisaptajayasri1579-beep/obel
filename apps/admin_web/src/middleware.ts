import { NextRequest, NextResponse } from "next/server";

/// Web Petugas Booth (app/petugas/) diarahkan lewat subdomain sendiri (mis.
/// petugas.obbelcoffee.com) tanpa jadi project Next.js terpisah — satu
/// deploy, satu api-client.ts, satu AuthProvider. `STAFF_HOSTNAME` kosong =
/// routing subdomain nonaktif, /petugas/* tetap bisa diakses langsung (dev
/// lokal tanpa perlu setup DNS/hosts file).
export function middleware(request: NextRequest) {
  const staffHostname = process.env.STAFF_HOSTNAME;
  if (!staffHostname) return NextResponse.next();

  const host = request.headers.get("host")?.split(":")[0];
  if (host !== staffHostname) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/petugas")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/petugas${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
