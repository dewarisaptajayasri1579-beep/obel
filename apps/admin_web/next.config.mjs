/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Menghasilkan build minimal (server.js + node_modules yang benar-benar
  // dipakai) di .next/standalone — dipakai oleh Dockerfile supaya image
  // Coolify tidak perlu bawa seluruh node_modules dev.
  output: 'standalone',
}

export default nextConfig
