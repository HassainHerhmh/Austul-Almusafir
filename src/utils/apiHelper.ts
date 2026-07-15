/**
 * Extract a list from an API response.
 * Supports:
 * 1) axios-like { data: [...] | { list|data: [...] } }
 * 2) { success: true, list: [...] }
 * 3) plain array
 */
export function extractList<T = any>(response: any): T[] {
  if (!response) return [];

  const data = response.data ?? response;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.data)) return data.data;

  return [];
}
