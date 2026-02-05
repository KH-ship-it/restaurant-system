import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Bỏ qua static & api
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
   }
  //  CHẠY i18n TRƯỚC (QUAN TRỌNG)
  const intlResponse = intlMiddleware(req);
  if (intlResponse) return intlResponse;

  // Lấy locale từ pathname
  const segments = pathname.split('/');
  const locale = routing.locales.includes(segments[1] as any)
    ? segments[1]
    : routing.defaultLocale;

  const pathnameWithoutLocale =
    pathname.replace(new RegExp(`^/${locale}`), '') || '/';

  //  Public routes (không cần login)
 const publicPaths = [
  '/login',
  '/goimon',
  '/auth/login',

  // THÊM
  '/api/qr',
  '/qr'
];

if (
  publicPaths.some(
    p =>
      pathnameWithoutLocale === p ||
      pathnameWithoutLocale.startsWith(p + '/')
  )
) {
  return NextResponse.next();
}

  //  Auth check
  const token = await getToken({ req });

  if (!token) {
    return NextResponse.redirect(
      new URL(`/${locale}/login`, req.url)
    );
  }
  return NextResponse.next();
}
export const config = {
  matcher: ['/', '/(vi|en)/:path*']
};
