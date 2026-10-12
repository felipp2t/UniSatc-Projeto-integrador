import { createRequire } from 'node:module'
import path from 'node:path'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const nodeRequire = createRequire(import.meta.url)
const phosphorIconsPath = nodeRequire.resolve('@phosphor-icons/react')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: './src/route-tree.gen.ts',
      // Colocated route tests (`*.test.ts` next to a route file) are not routes.
      routeFileIgnorePattern: '\\.test\\.[tj]sx?$',
      routesDirectory: './src/pages',
      routeToken: 'layout',
      target: 'react',
    }),
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // Use Phosphor's CommonJS build in tests so Vitest does not transform its
    // thousands of ESM icon modules. Production resolution remains unchanged.
    alias: [
      {
        find: /^@phosphor-icons\/react$/,
        replacement: phosphorIconsPath,
      },
    ],
    setupFiles: ['./src/test/setup.ts'],
  },
})
