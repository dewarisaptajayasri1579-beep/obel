import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Monorepo tanpa workspaces: kalau ada lockfile di folder induk (dulu ada di
  // root repo), Next.js menebak root-nya ke sana, bukan folder app ini, dan
  // build manifest-nya (.next/server/...) berakhir di lokasi yang tidak
  // konsisten antar restart dev server. Dikunci ke folder ini.
  outputFileTracingRoot: __dirname,
  // `lucide-react` mengekspor tiap ikon dari satu barrel file raksasa — tanpa
  // ini, webpack dev server menaruh SEMUANYA di satu vendor chunk, dan compile
  // beberapa route sekaligus gampang membuat chunk itu dibaca sebelum selesai
  // ditulis (`ENOENT .../vendor-chunks/lucide-react.js`, dev server macet total
  // sampai di-restart). Opsi ini memaksa tiap ikon dikompilasi terpisah.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Menghasilkan build minimal (server.js + node_modules yang benar-benar
  // dipakai) di .next/standalone — dipakai oleh Dockerfile supaya image
  // Coolify tidak perlu bawa seluruh node_modules dev.
  output: 'standalone',
}

export default nextConfig
