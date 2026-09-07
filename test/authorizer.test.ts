import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAuthorizer } from '../src/authorizer.ts';
import { gerarToken } from '../src/jwt.ts';

const SEGREDO = 'segredo-de-teste-com-mais-de-256-bits-para-hmac-sha256!!';

const authorizer = criarAuthorizer({ obterSegredo: async () => SEGREDO });

function evento(cabecalhos: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    version: '2.0',
    type: 'REQUEST',
    routeKey: 'ANY /api/{proxy+}',
    headers: cabecalhos,
    requestContext: { requestId: 'req-1' },
  } as any;
}

async function tokenValido() {
  const { accessToken } = await gerarToken(
    { sub: '52998224725', clienteId: 'c-1', nome: 'Ana', role: 'CLIENTE' },
    SEGREDO,
  );
  return accessToken;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Lambda Authorizer', () => {
  it('autoriza e expoe as claims no context', async () => {
    const resultado = await authorizer(evento({ authorization: `Bearer ${await tokenValido()}` }));

    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context).toMatchObject({
      clienteId: 'c-1',
      cpf: '52998224725',
      role: 'CLIENTE',
    });
  });

  it('aceita o cabecalho com capitalizacao diferente', async () => {
    const resultado = await authorizer(evento({ Authorization: `Bearer ${await tokenValido()}` }));
    expect(resultado.isAuthorized).toBe(true);
  });

  it('nega quando nao ha cabecalho Authorization', async () => {
    expect((await authorizer(evento({}))).isAuthorized).toBe(false);
  });

  it('nega quando o esquema nao e Bearer', async () => {
    const resultado = await authorizer(evento({ authorization: `Basic ${await tokenValido()}` }));
    expect(resultado.isAuthorized).toBe(false);
  });

  it('nega token assinado com outro segredo', async () => {
    const { accessToken } = await gerarToken(
      { sub: '52998224725', clienteId: 'c-1', nome: 'Ana', role: 'CLIENTE' },
      `${SEGREDO}-invasor`,
    );

    expect((await authorizer(evento({ authorization: `Bearer ${accessToken}` }))).isAuthorized).toBe(false);
  });

  it('nega token expirado', async () => {
    vi.stubEnv('JWT_EXPIRATION_SECONDS', '-10');
    const { accessToken } = await gerarToken(
      { sub: '52998224725', clienteId: 'c-1', nome: 'Ana', role: 'CLIENTE' },
      SEGREDO,
    );
    vi.unstubAllEnvs();

    expect((await authorizer(evento({ authorization: `Bearer ${accessToken}` }))).isAuthorized).toBe(false);
  });
});
