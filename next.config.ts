import { execFileSync } from 'node:child_process'
import type { NextConfig } from 'next'

function resolveBuildCommitSha() {
  const environmentSha = [
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
  ].find((value) => value?.trim())

  if (environmentSha) return environmentSha.trim()

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    // The acceptance lab already reads this public key. Supplying it from the
    // checked-out Git repository also gives local and VPS builds the same
    // provenance that Vercel deployments receive automatically.
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: resolveBuildCommitSha(),
  },
}

export default nextConfig
