export function resolveAssetPath(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Strip leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : base + '/'}${cleanPath}`;
}
