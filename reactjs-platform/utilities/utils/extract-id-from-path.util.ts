export const extractIdFromPath = (path: string): string | null => {
  const match = path.match(/id=([a-zA-Z0-9-]+)/);

  return match ? (match[1] ?? null) : null;
};
