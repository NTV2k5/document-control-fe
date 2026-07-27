/**
 * Format avatar/profile URL to include VITE_API_URL if it is a relative path.
 */
export const formatAvatarUrl = (url: string | null | undefined): string => {
  if (!url) return 'https://i.pravatar.cc/150?u=a042581f4e29026024d';

  let cleanUrl = url;
  const backendHost = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_ENDPOINT || '')
    .replace(/^https?:\/\//, '')
    .trim();

  if (backendHost) {
    const hostRegex = new RegExp(`^https?://${backendHost.replace(/\./g, '\\.')}`);
    if (hostRegex.test(cleanUrl)) {
      cleanUrl = cleanUrl.replace(hostRegex, '');
    }
  }

  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }

  const baseUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_ENDPOINT || '').trim();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const formattedUrl = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;

  if (import.meta.env.DEV) {
    return formattedUrl;
  }

  return `${cleanBase}${formattedUrl}`;
};
