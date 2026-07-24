/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the shared core package (it ships TypeScript source, not a build).
  transpilePackages: ['@airlink/core'],
};

export default nextConfig;
