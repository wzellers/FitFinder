/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this folder. Without it, a git worktree under
  // .claude/worktrees/ sees the main checkout's package-lock.json too and
  // Next warns about multiple lockfiles.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
