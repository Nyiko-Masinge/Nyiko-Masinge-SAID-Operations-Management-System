import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/**
 * Keep development's incremental output away from the production build output.
 * This prevents a running dev server from serving chunks overwritten by `next build`.
 */
export default function nextConfig(phase) {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next-prod',
  };
}
