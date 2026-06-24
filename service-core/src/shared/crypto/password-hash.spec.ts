import { hashPassword, verifyPassword } from './password-hash';

describe('password-hash', () => {
  it('hashPassword gera formato scrypt$salt$hash', () => {
    const stored = hashPassword('ReserveHub1!');
    expect(stored).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/i);
  });

  it('verifyPassword aceita password correcta', () => {
    const plain = 'senha-segura-123';
    const stored = hashPassword(plain);
    expect(verifyPassword(plain, stored)).toBe(true);
  });

  it('verifyPassword rejeita password errada', () => {
    const stored = hashPassword('certa');
    expect(verifyPassword('errada', stored)).toBe(false);
  });

  it('verifyPassword rejeita formato inválido', () => {
    expect(verifyPassword('x', 'bcrypt$foo')).toBe(false);
    expect(verifyPassword('x', 'plain')).toBe(false);
  });

  it('hashes diferentes para a mesma senha (salt aleatório)', () => {
    const a = hashPassword('mesma');
    const b = hashPassword('mesma');
    expect(a).not.toBe(b);
    expect(verifyPassword('mesma', a)).toBe(true);
    expect(verifyPassword('mesma', b)).toBe(true);
  });
});
