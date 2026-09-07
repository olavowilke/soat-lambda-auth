import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/secrets.ts', () => ({
  obterSegredo: vi.fn(async () => 'segredo-do-secrets-manager'),
  obterSegredoJson: vi.fn(async () => ({ username: 'rds_user', password: 'rds_pass' })),
}));

const { obterSegredoJwt, obterConfiguracaoBanco, configuracaoToken } = await import('../src/config.ts');
const { obterSegredo, obterSegredoJson } = await import('../src/secrets.ts');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('obterSegredoJwt', () => {
  it('usa JWT_SECRET quando definido (execucao local)', async () => {
    vi.stubEnv('JWT_SECRET', 'segredo-local');

    await expect(obterSegredoJwt()).resolves.toBe('segredo-local');
    expect(obterSegredo).not.toHaveBeenCalled();
  });

  it('busca no Secrets Manager quando ha JWT_SECRET_ARN', async () => {
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('JWT_SECRET_ARN', 'arn:aws:secretsmanager:...:jwt');

    await expect(obterSegredoJwt()).resolves.toBe('segredo-do-secrets-manager');
    expect(obterSegredo).toHaveBeenCalledWith('arn:aws:secretsmanager:...:jwt');
  });

  it('falha quando nenhuma das duas origens esta configurada', async () => {
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('JWT_SECRET_ARN', '');

    await expect(obterSegredoJwt()).rejects.toThrow(/JWT_SECRET/);
  });
});

describe('obterConfiguracaoBanco', () => {
  it('monta a conexao a partir das variaveis de ambiente locais', async () => {
    vi.stubEnv('DB_SECRET_ARN', '');
    vi.stubEnv('DB_HOST', 'localhost');
    vi.stubEnv('DB_PORT', '5432');
    vi.stubEnv('DB_NAME', 'oficina_db');
    vi.stubEnv('DB_USERNAME', 'oficina');
    vi.stubEnv('DB_PASSWORD', 'oficina');
    vi.stubEnv('DB_SSL', 'false');

    await expect(obterConfiguracaoBanco()).resolves.toEqual({
      host: 'localhost',
      port: 5432,
      database: 'oficina_db',
      user: 'oficina',
      password: 'oficina',
      ssl: false,
    });
    expect(obterSegredoJson).not.toHaveBeenCalled();
  });

  it('usa as credenciais do Secrets Manager quando ha DB_SECRET_ARN', async () => {
    vi.stubEnv('DB_SECRET_ARN', 'arn:aws:secretsmanager:...:rds');
    vi.stubEnv('DB_HOST', 'oficina.rds.amazonaws.com');
    vi.stubEnv('DB_SSL', 'true');

    const config = await obterConfiguracaoBanco();

    expect(obterSegredoJson).toHaveBeenCalledWith('arn:aws:secretsmanager:...:rds');
    expect(config).toMatchObject({ user: 'rds_user', password: 'rds_pass', ssl: true });
  });
});

describe('configuracaoToken', () => {
  it('aplica os padroes esperados pela aplicacao', () => {
    expect(configuracaoToken.emissor()).toBe('oficina-auth');
    expect(configuracaoToken.audiencia()).toBe('oficina-api');
    expect(configuracaoToken.expiracaoSegundos()).toBe(3600);
  });

  it('respeita as variaveis de ambiente', () => {
    vi.stubEnv('JWT_ISSUER', 'outro-emissor');
    vi.stubEnv('JWT_EXPIRATION_SECONDS', '900');

    expect(configuracaoToken.emissor()).toBe('outro-emissor');
    expect(configuracaoToken.expiracaoSegundos()).toBe(900);
  });
});
