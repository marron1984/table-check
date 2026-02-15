/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {},
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};
module.exports = nextConfig;
