/**
 * Resolucao de configuracao. Em AWS os valores sensiveis vem do Secrets Manager;
 * localmente (`npm run dev`, testes) as variaveis de ambiente equivalentes
 * substituem a chamada, mantendo o mesmo codigo de handler nos dois modos.
 */
import { obterSegredo, obterSegredoJson } from './secrets.ts';

export interface CredenciaisBanco {
  username: string;
  password: string;
  host?: string;
  port?: number;
  dbname?: string;
}

export interface ConfiguracaoBanco {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export async function obterSegredoJwt(): Promise<string> {
  const direto = process.env.JWT_SECRET;
  if (direto) return direto;

  const arn = process.env.JWT_SECRET_ARN;
  if (!arn) throw new Error('Defina JWT_SECRET (local) ou JWT_SECRET_ARN (AWS)');
  return obterSegredo(arn);
}

export async function obterConfiguracaoBanco(): Promise<ConfiguracaoBanco> {
  const arn = process.env.DB_SECRET_ARN;
  const credenciais: CredenciaisBanco = arn
    ? await obterSegredoJson<CredenciaisBanco>(arn)
    : { username: process.env.DB_USERNAME ?? 'oficina', password: process.env.DB_PASSWORD ?? 'oficina' };

  return {
    host: process.env.DB_HOST ?? credenciais.host ?? 'localhost',
    port: Number(process.env.DB_PORT ?? credenciais.port ?? 5432),
    database: process.env.DB_NAME ?? credenciais.dbname ?? 'oficina_db',
    user: credenciais.username,
    password: credenciais.password,
    ssl: (process.env.DB_SSL ?? 'true') === 'true',
  };
}

export const configuracaoToken = {
  emissor: () => process.env.JWT_ISSUER ?? 'oficina-auth',
  audiencia: () => process.env.JWT_AUDIENCE ?? 'oficina-api',
  expiracaoSegundos: () => Number(process.env.JWT_EXPIRATION_SECONDS ?? 3600),
};
