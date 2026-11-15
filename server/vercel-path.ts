/**
 * Vercel's explicit `/api/(.*) -> /api/index?__path=$1` rewrite can hand the
 * function the destination path instead of the public path. Restore the public
 * `/api/...` path before Express routes the request, while preserving query
 * parameters. If the platform already passes the original URL, leave it alone.
 */
export function restoreVercelApiPath(rawUrl: string): string {
  const url = new URL(rawUrl, 'http://vercel.local');
  const rewrittenPath = url.searchParams.get('__path');
  if (rewrittenPath === null) return rawUrl;

  url.searchParams.delete('__path');
  const path = rewrittenPath.replace(/^\/+/, '');
  const query = url.searchParams.toString();
  return `/api/${path}${query ? `?${query}` : ''}`;
}
