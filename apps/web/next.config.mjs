/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the shared core package (it ships TypeScript source, not a build).
  transpilePackages: ["@airlink/core"],
  // Keep the Postgres driver out of the bundle — it's a Node module (net/tls)
  // required at runtime on the server, never shipped to the client.
  serverExternalPackages: ["pg"],
  output: "standalone",
};
export default nextConfig;
