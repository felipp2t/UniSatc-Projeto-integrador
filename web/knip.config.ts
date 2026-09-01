import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    '**/.env*',
    '**/secrets/**',
    '**/*.pem',
    '**/*.key',
    '.claude/skills/**',
    '.agents/skills/**',
  ],
  ignoreDependencies: ['@biomejs/biome', 'globals'],
}

export default config
