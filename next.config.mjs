/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Deliberately empty: any hostname listed here can be fetched by
    // /_next/image and re-served from this origin under our TLS cert and
    // bandwidth. The previous wildcards ('**.amazonaws.com',
    // '**.cloudflare.com') matched every S3 bucket on the internet and were
    // unused — nothing in the codebase stores or serves images from either.
    // Re-add specific { protocol, hostname, pathname } entries only when a
    // real remote image host ships. User-supplied photo/logo URLs are rendered
    // with plain <img> so they never pass through the optimizer.
    remotePatterns: [],
    // Cache optimized images for 24h instead of the 60s default so a single
    // allowlisted source cannot be used to drive repeated re-optimization.
    minimumCacheTTL: 86400,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Security headers configuration
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';

    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: isDevelopment
              ? 'max-age=0'
              : 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)'
          },
        ],
      },
    ];
  },
};

export default nextConfig;
