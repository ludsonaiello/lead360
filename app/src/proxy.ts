/**
 * Next.js Middleware
 * Handles authentication and route protection
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/activate',
  '/public/share', // Public share links (no auth required)
  '/public/quotes', // Public quote viewer (no auth required)
];

// Routes that should redirect to dashboard if authenticated
const authRoutes = [
  '/login',
  '/register',
];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[PROXY] Request:', {
    pathname,
    host: request.headers.get('host'),
    timestamp: new Date().toISOString()
  });

  // Get access token from cookies
  const accessToken = request.cookies.get('access_token')?.value;
  const isAuthenticated = !!accessToken;

  // Check if the route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Check if it's an auth page (login/register)
  const isAuthPage = authRoutes.some((route) => pathname.startsWith(route));

  // CRITICAL: Allow all /public routes without ANY auth checks
  if (pathname.startsWith('/public')) {
    console.log('[PROXY] >>> PUBLIC ROUTE - ALLOWING <<<');
    return NextResponse.next();
  }

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (isAuthenticated && isAuthPage) {
    console.log('[PROXY] Authenticated user on auth page - redirecting to dashboard');
    const dashboardUrl = new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL || request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // If user is not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicRoute && pathname !== '/') {
    console.log('[PROXY] Unauthenticated user on protected route - redirecting to login');
    // Redirect to login with return URL (maintain current host/subdomain)
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  console.log('[PROXY] Allowing route');
  return NextResponse.next();
}

// Configure middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
