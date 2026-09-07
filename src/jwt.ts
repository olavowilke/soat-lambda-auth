/**
 * Emissao e verificacao do JWT.
 *
 * HS256 com segredo compartilhado: a mesma chave assina aqui, e valida no
 * Lambda Authorizer do API Gateway e no `JwtService` da aplicacao Spring
 * (que usa `Keys.hmacShaKeyFor(secret.getBytes(UTF_8))` — logo, os bytes UTF-8
 * crus do segredo, exatamente o que `TextEncoder` produz).
 */
import { SignJWT, jwtVerify } from 'jose';
import { configuracaoToken } from './config.ts';

const ALGORITMO = 'HS256';

/** Claims do token emitido para um cliente autenticado por CPF. */
export interface ClaimsCliente {
  /** CPF (somente digitos) do cliente autenticado. */
  sub: string;
  clienteId: string;
  nome: string;
  role: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

/** Subconjunto informado por quem emite; o restante e preenchido aqui. */
export type ClaimsEmissao = Pick<ClaimsCliente, 'sub' | 'clienteId' | 'nome' | 'role'>;

export interface TokenEmitido {
  accessToken: string;
  expiresIn: number;
  expiresAt: string;
}

function chave(segredo: string): Uint8Array {
  return new TextEncoder().encode(segredo);
}

export async function gerarToken(claims: ClaimsEmissao, segredo: string): Promise<TokenEmitido> {
  const expiracaoSegundos = configuracaoToken.expiracaoSegundos();
  const agora = Math.floor(Date.now() / 1000);
  const expiraEm = agora + expiracaoSegundos;

  const accessToken = await new SignJWT({
    clienteId: claims.clienteId,
    nome: claims.nome,
    role: claims.role,
  })
    .setProtectedHeader({ alg: ALGORITMO, typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(configuracaoToken.emissor())
    .setAudience(configuracaoToken.audiencia())
    .setIssuedAt(agora)
    .setExpirationTime(expiraEm)
    .sign(chave(segredo));

  return {
    accessToken,
    expiresIn: expiracaoSegundos,
    expiresAt: new Date(expiraEm * 1000).toISOString(),
  };
}

export async function verificarToken(token: string, segredo: string): Promise<ClaimsCliente> {
  const { payload } = await jwtVerify(token, chave(segredo), {
    algorithms: [ALGORITMO],
    issuer: configuracaoToken.emissor(),
    audience: configuracaoToken.audiencia(),
  });
  return payload as unknown as ClaimsCliente;
}
