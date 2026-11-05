export function resolveAssetPath(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Strip leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const base = import.meta.env.BASE_URL || '/';
  const fullUrl = `${base.endsWith('/') ? base : base + '/'}${cleanPath}`;

  // Cache-busting query parameter for static maps to ensure installed PWAs load updated radar images immediately
  if (cleanPath.startsWith('maps/')) {
    return `${fullUrl}?v=20261105_v6`;
  }
  return fullUrl;
}

