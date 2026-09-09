export const readCsrfToken = (cookies: string = document.cookie): string | null => {
  const entry = cookies.split(';').map(part => part.trim()).find(part => part.startsWith('XSRF-TOKEN='));
  if (!entry) return null;

  try {
    return decodeURIComponent(entry.substring('XSRF-TOKEN='.length));
  } catch {
    return null;
  }
};
