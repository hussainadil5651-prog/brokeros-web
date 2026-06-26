export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/batches/:path*',
    '/loads/:path*',
    '/carriers/:path*',
    '/invoices/:path*',
    '/follow-ups/:path*',
    '/active/:path*',
    '/ai/:path*',
    '/sheets/:path*',
    '/outreach/:path*',
    '/prospects/:path*',
    '/customers/:path*',
    '/settings/:path*',
    '/dispatch/:path*',
  ],
}
