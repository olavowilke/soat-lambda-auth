import { afterEach, describe, expect, it, vi } from 'vitest';

const enviar = vi.fn();

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    send = enviar;
  },
  GetSecretValueCommand: class {
    constructor(public readonly input: { SecretId: string }) {}
  },
}));

const { obterSegredo, obterSegredoJson, limparCacheDeSegredos } = await import('../src/secrets.ts');

afterEach(() => {
  limparCacheDeSegredos();
  enviar.mockReset();
  vi.useRealTimers();
});

describe('obterSegredo', () => {
  it('busca o segredo no Secrets Manager', async () => {
    enviar.mockResolvedValue({ SecretString: 'valor-secreto' });

    await expect(obterSegredo('arn:jwt')).resolves.toBe('valor-secreto');
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('reaproveita o cache entre invocacoes do mesmo container', async () => {
    enviar.mockResolvedValue({ SecretString: 'valor-secreto' });

    await obterSegredo('arn:jwt');
    await obterSegredo('arn:jwt');

    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('busca de novo depois que o TTL expira (rotacao de senha)', async () => {
    vi.useFakeTimers();
    enviar.mockResolvedValue({ SecretString: 'valor-secreto' });

    await obterSegredo('arn:rds');
    vi.advanceTimersByTime(6 * 60 * 1000);
    await obterSegredo('arn:rds');

    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('falha quando o segredo nao tem SecretString', async () => {
    enviar.mockResolvedValue({});

    await expect(obterSegredo('arn:binario')).rejects.toThrow(/SecretString/);
  });
});

describe('obterSegredoJson', () => {
  it('desserializa o segredo em JSON', async () => {
    enviar.mockResolvedValue({ SecretString: '{"username":"u","password":"p"}' });

    await expect(obterSegredoJson('arn:rds')).resolves.toEqual({ username: 'u', password: 'p' });
  });
});
