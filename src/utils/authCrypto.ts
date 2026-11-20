export const DEFAULT_ADMIN_PASSWORD = 'admin123';

export async function hashPassword(password: string): Promise<string> {
  const input = `hadirscan_salt_v1:${password}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback below if subtle crypto is unavailable
  }

  // Deterministic non-empty fallback hash for non-secure contexts
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export async function verifyAdminPassword(
  candidate: string,
  storedHash?: string
): Promise<boolean> {
  if (!storedHash) {
    return candidate === DEFAULT_ADMIN_PASSWORD;
  }
  const candidateHash = await hashPassword(candidate);
  return candidateHash === storedHash;
}
