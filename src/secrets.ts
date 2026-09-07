/**
 * Leitura de segredos do AWS Secrets Manager com cache em memoria.
 *
 * O cache vive no escopo do modulo: sobrevive entre invocacoes no mesmo
 * container Lambda, o que elimina uma chamada de rede no caminho quente.
 * TTL curto para que a rotacao de senha do RDS seja percebida sem redeploy.
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const TTL_MS = Number(process.env.SECRET_CACHE_TTL_MS ?? 5 * 60 * 1000);

interface Entrada {
  valor: string;
  expiraEm: number;
}

const cache = new Map<string, Entrada>();
let client: SecretsManagerClient | undefined;

function obterClient(): SecretsManagerClient {
  client ??= new SecretsManagerClient({});
  return client;
}

export async function obterSegredo(secretId: string): Promise<string> {
  const agora = Date.now();
  const emCache = cache.get(secretId);
  if (emCache && emCache.expiraEm > agora) return emCache.valor;

  const resposta = await obterClient().send(new GetSecretValueCommand({ SecretId: secretId }));
  const valor = resposta.SecretString;
  if (!valor) throw new Error(`Segredo ${secretId} sem SecretString`);

  cache.set(secretId, { valor, expiraEm: agora + TTL_MS });
  return valor;
}

export async function obterSegredoJson<T>(secretId: string): Promise<T> {
  return JSON.parse(await obterSegredo(secretId)) as T;
}

/** Usado nos testes e no servidor de desenvolvimento local. */
export function limparCacheDeSegredos(): void {
  cache.clear();
}
