/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required: web-llm uses top-level await and large WASM chunks
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // web-llm is browser-only; don't bundle on server
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };
    return config;
  },
  // Allow large model weights to be served if cached locally
  experimental: {
    serverComponentsExternalPackages: ["mongoose"],
  },
};

export default nextConfig;
