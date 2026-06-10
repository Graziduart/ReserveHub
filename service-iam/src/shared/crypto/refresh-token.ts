import { createHash, randomBytes } from 'node:crypto';

export type RefreshTokenPair = {
  /** Valor opaco enviado ao cliente (apenas na emissão). */
  raw: string;
  /** SHA-256 hex guardado na base de dados. */
  hash: string;
};

export function createRefreshTokenOpaque(): RefreshTokenPair {
  const raw = randomBytes(48).toString('base64url');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
