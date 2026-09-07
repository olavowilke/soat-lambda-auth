import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeJwt } from 'jose';
import { criarHandler } from '../src/handler.ts';
import type { ClienteAutenticavel } from '../src/clienteRepository.ts';

const SEGREDO = 'segredo-de-teste-com-mais-de-256-bits-para-hmac-sha256!!';
const CPF_VALIDO = '52998224725';

function evento(corpo: unknown, cabecalhos: Record<string, string> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    version: '2.0',
    routeKey: 'POST /auth/token',
    rawPath: '/auth/token',
    headers: { 'x-correlation-id': 'corr-1', ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    isBase64Encoded: false,
    requestContext: { requestId: 'req-1' },
  } as any;
}

function handlerCom(cliente: ClienteAutenticavel | null, erro?: Error) {
  const buscarPorCpf = vi.fn(async () => {
    if (erro) throw erro;
    return cliente;
  });
  return {
    buscarPorCpf,
    handler: criarHandler({
      repository: { buscarPorCpf },
      obterSegredo: async () => SEGREDO,
    }),
  };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /auth/token', () => {
  it('devolve 200 com JWT quando o cliente existe e esta ativo', async () => {
    const { handler, buscarPorCpf } = handlerCom({ id: 'c-1', nome: 'Ana Souza', ativo: true });

    const resposta = await handler(evento({ cpf: '529.982.247-25' }));

    expect(resposta.statusCode).toBe(200);
    expect(buscarPorCpf).toHaveBeenCalledWith(CPF_VALIDO);

    const corpo = JSON.parse(resposta.body as string);
    expect(corpo.tokenType).toBe('Bearer');
    expect(corpo.cliente).toEqual({ id: 'c-1', nome: 'Ana Souza', cpf: '529.***.***-25' });

    const claims = decodeJwt(corpo.accessToken);
    expect(claims).toMatchObject({ sub: CPF_VALIDO, clienteId: 'c-1', role: 'CLIENTE' });
  });

  it('devolve 400 quando o CPF e invalido, sem consultar o banco', async () => {
    const { handler, buscarPorCpf } = handlerCom(null);

    const resposta = await handler(evento({ cpf: '11111111111' }));

    expect(resposta.statusCode).toBe(400);
    expect(buscarPorCpf).not.toHaveBeenCalled();
    expect(JSON.parse(resposta.body as string).message).toBe('CPF invalido');
  });

  it('devolve 400 quando o corpo nao traz CPF', async () => {
    const { handler } = handlerCom(null);
    expect((await handler(evento({}))).statusCode).toBe(400);
    expect((await handler(evento(undefined))).statusCode).toBe(400);
  });

  it('devolve 404 quando nao ha cliente para o CPF', async () => {
    const { handler } = handlerCom(null);

    const resposta = await handler(evento({ cpf: CPF_VALIDO }));

    expect(resposta.statusCode).toBe(404);
  });

  it('devolve 403 quando o cliente esta inativo', async () => {
    const { handler } = handlerCom({ id: 'c-2', nome: 'Bruno', ativo: false });

    const resposta = await handler(evento({ cpf: CPF_VALIDO }));

    expect(resposta.statusCode).toBe(403);
  });

  it('devolve 500 e nao vaza detalhe da falha quando o banco cai', async () => {
    const { handler } = handlerCom(null, new Error('connection refused'));

    const resposta = await handler(evento({ cpf: CPF_VALIDO }));

    expect(resposta.statusCode).toBe(500);
    expect(resposta.body).not.toContain('connection refused');
  });

  it('propaga o correlation id recebido do API Gateway', async () => {
    const { handler } = handlerCom({ id: 'c-1', nome: 'Ana', ativo: true });

    const resposta = await handler(evento({ cpf: CPF_VALIDO }, { 'x-correlation-id': 'abc-123' }));

    expect(resposta.headers?.['x-correlation-id']).toBe('abc-123');
  });

  it('aceita corpo em base64 (integracao do API Gateway)', async () => {
    const { handler } = handlerCom({ id: 'c-1', nome: 'Ana', ativo: true });

    const base = evento({ cpf: CPF_VALIDO });
    const resposta = await handler({
      ...base,
      body: Buffer.from(base.body as string).toString('base64'),
      isBase64Encoded: true,
    });

    expect(resposta.statusCode).toBe(200);
  });
});
