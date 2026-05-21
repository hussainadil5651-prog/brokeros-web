export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/batches/:path*',
    '/loads/:path*',
    '/loads/:path*/:path*',
    '/carriers/:path*',
    '/carriers/:path*/:path*',
    '/invoices/:path*',
    '/follow-ups/:path*',
    '/active/:path*',
    '/ai/:path*',
    '/sheets/:path*',
  ],
}
