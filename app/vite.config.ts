import fs from "fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { visualizer } from "rollup-plugin-visualizer"

function injectServiceWorkerBuildId() {
  const buildId = (process.env.BUILD_ID || process.env.GITHUB_SHA?.slice(0, 12) || new Date().toISOString().replace(/\D/g, "")).trim()

  return {
    name: "inject-service-worker-build-id",
    apply: "build" as const,
    closeBundle() {
      const swPath = path.resolve(__dirname, "dist/sw.js")
      if (!fs.existsSync(swPath)) return

      const source = fs.readFileSync(swPath, "utf8")
      fs.writeFileSync(swPath, source.replace(/thebooktimes-__BUILD_ID__/g, `thebooktimes-${buildId}`))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    injectServiceWorkerBuildId(),
    // Bundle analyzer — generates stats.html in dist/ when ANALYZE=true
    ...(process.env.ANALYZE ? [visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    })] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // Remove console.log in production
        drop_debugger: true,
        passes: 2,
      },
    },
    // Chunk splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - split large libraries
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
          ],
          'charts': ['recharts'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets < 4KB
    // Enable source maps for debugging (disabled in prod)
    sourcemap: false,
    // CSS code splitting
    cssCodeSplit: true,
  },
  // Dev server settings — enables HMR inside Docker containers
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      // Use polling for Docker volume mounts (inotify doesn't work across host ↔ container)
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      // Connect back to the host's exposed port for HMR websocket
      host: 'localhost',
      port: 5173,
    },
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'framer-motion',
      'lucide-react',
    ],
  },
});
