import { describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import { gerarToken, verificarToken } from '../src/jwt.ts';

const SEGREDO = 'segredo-de-teste-com-mais-de-256-bits-para-hmac-sha256!!';

describe('gerarToken', () => {
  it('emite token com as claims do cliente autenticado', async () => {
    const { accessToken, expiresIn } = await gerarToken(
      { sub: '52998224725', clienteId: 'c-1', nome: 'Ana', role: 'CLIENTE' },
      SEGREDO,
    );

    const claims = decodeJwt(accessToken);
    expect(claims.sub).toBe('52998224725');
    expect(claims.clienteId).toBe('c-1');
    expect(claims.role).toBe('CLIENTE');
    expect(claims.iss).toBe('oficina-auth');
    expect(claims.aud).toBe('oficina-api');
    expect(expiresIn).toBe(3600);
  });
});

describe('verificarToken', () => {
  it('aceita token assinado com o mesmo segredo', async () => {
    const { accessToken } = await gerarToken(
      { sub: '52998224725', clienteId: 'c-1', nome: 'Ana', role: 'CLIENTE' },
      SEGREDO,
    );

    await expect(verificarToken(accessToken, SEGREDO)).resolves.toMatchObject({ clienteId: 'c-1' });
  });

  it('rejeita token assinado com outro segredo', async () => {
    const { accessToken } = await gerarToken(
      { sub: '52998224725', clienteId: 'c-1', nome: 'Ana', role: 'CLIENTE' },
      SEGREDO,
    );

    await expect(verificarToken(accessToken, `${SEGREDO}-outro`)).rejects.toThrow();
  });

  it('rejeita token malformado', async () => {
    await expect(verificarToken('nao-e-um-jwt', SEGREDO)).rejects.toThrow();
  });
});
