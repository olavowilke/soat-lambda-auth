/**
 * Lambda Authorizer do API Gateway (payload v2, resposta "simple").
 *
 * Protege as rotas sensiveis: sem um JWT valido — emitido pelo fluxo de
 * autenticacao por CPF — a requisicao nem chega ao cluster. As claims viram
 * `context`, que o API Gateway repassa ao backend como cabecalhos, permitindo
 * a aplicacao saber qual cliente esta autenticado sem reprocessar o token.
 */
import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult } from 'aws-lambda';
import { verificarToken } from './jwt.ts';
import { obterSegredoJwt } from './config.ts';
import { logger } from './logger.ts';

export interface ContextoAutorizacao extends Record<string, string> {
  clienteId: string;
  cpf: string;
  nome: string;
  role: string;
}

type Resultado = APIGatewaySimpleAuthorizerWithContextResult<Partial<ContextoAutorizacao>>;

const NEGADO: Resultado = { isAuthorized: false, context: {} };

export interface DependenciasAuthorizer {
  obterSegredo: () => Promise<string>;
}

function extrairToken(evento: APIGatewayRequestAuthorizerEventV2): string | undefined {
  const cabecalhos = evento.headers ?? {};
  const authorization = cabecalhos['authorization'] ?? cabecalhos['Authorization'];
  if (!authorization) return undefined;
  const [esquema, valor] = authorization.split(' ');
  if (!valor || esquema?.toLowerCase() !== 'bearer') return undefined;
  return valor;
}

export function criarAuthorizer(
  dependencias: DependenciasAuthorizer = { obterSegredo: obterSegredoJwt },
) {
  return async function authorizer(
    evento: APIGatewayRequestAuthorizerEventV2,
  ): Promise<Resultado> {
    const correlationId = evento.requestContext?.requestId ?? 'sem-correlacao';
    const token = extrairToken(evento);

    if (!token) {
      logger.warn('Requisicao sem Bearer token', { correlationId, rota: evento.routeKey });
      return NEGADO;
    }

    try {
      const claims = await verificarToken(token, await dependencias.obterSegredo());
      logger.info('Acesso autorizado', {
        correlationId,
        rota: evento.routeKey,
        clienteId: String(claims.clienteId ?? ''),
      });
      return {
        isAuthorized: true,
        context: {
          clienteId: String(claims.clienteId ?? ''),
          cpf: String(claims.sub ?? ''),
          nome: String(claims.nome ?? ''),
          role: String(claims.role ?? 'CLIENTE'),
        },
      };
    } catch (causa) {
      logger.warn('Token rejeitado', {
        correlationId,
        rota: evento.routeKey,
        motivo: causa instanceof Error ? causa.message : String(causa),
      });
      return NEGADO;
    }
  };
}

export const handler = criarAuthorizer();
