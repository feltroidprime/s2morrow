import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm"
    return config
  },
}

export default nextConfig
