/**
 * Acesso ao banco gerenciado (RDS PostgreSQL) para consultar o cliente pelo CPF.
 *
 * O Pool fica no escopo do modulo para ser reaproveitado entre invocacoes do
 * mesmo container. `max: 2` porque cada container Lambda atende uma requisicao
 * por vez — abrir mais conexoes so consome o limite do RDS.
 */
import { Pool } from 'pg';
import { obterConfiguracaoBanco } from './config.ts';

export interface ClienteAutenticavel {
  id: string;
  nome: string;
  ativo: boolean;
}

let pool: Pool | undefined;

async function obterPool(): Promise<Pool> {
  if (pool) return pool;
  const config = await obterConfiguracaoBanco();
  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5_000),
  });
  return pool;
}

const CONSULTA = `
  SELECT id, nome, ativo
    FROM clientes
   WHERE documento = $1
     AND tipo_documento = 'CPF'
   LIMIT 1
`;

export interface ClienteRepository {
  buscarPorCpf(cpf: string): Promise<ClienteAutenticavel | null>;
}

export const clienteRepository: ClienteRepository = {
  async buscarPorCpf(cpf: string): Promise<ClienteAutenticavel | null> {
    const conexao = await obterPool();
    const resultado = await conexao.query<ClienteAutenticavel>(CONSULTA, [cpf]);
    return resultado.rows[0] ?? null;
  },
};

/** Encerra o pool — usado pelo servidor de desenvolvimento e pelos testes. */
export async function encerrarPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
