/**
 * POST /auth/token — autenticacao do cliente por CPF.
 *
 * Fluxo (requisito da Fase 3):
 *   1. valida o CPF (formato + digitos verificadores);
 *   2. consulta a existencia e o status do cliente na base gerenciada;
 *   3. devolve um JWT valido para consumo das APIs protegidas.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';
import { isCpfValido, mascararCpf, normalizarCpf } from './cpf.ts';
import { gerarToken } from './jwt.ts';
import { obterSegredoJwt } from './config.ts';
import { clienteRepository, type ClienteRepository } from './clienteRepository.ts';
import { logger } from './logger.ts';

export interface Dependencias {
  repository: ClienteRepository;
  obterSegredo: () => Promise<string>;
}

const dependenciasPadrao: Dependencias = {
  repository: clienteRepository,
  obterSegredo: obterSegredoJwt,
};

function resposta(
  status: number,
  corpo: unknown,
  correlationId: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', 'x-correlation-id': correlationId },
    body: JSON.stringify(corpo),
  };
}

function erro(status: number, tipo: string, mensagem: string, correlationId: string) {
  return resposta(status, { status, error: tipo, message: mensagem, correlationId }, correlationId);
}

function extrairCorrelationId(evento: APIGatewayProxyEventV2, contexto?: Context): string {
  const cabecalhos = evento.headers ?? {};
  return (
    cabecalhos['x-correlation-id'] ??
    cabecalhos['X-Correlation-Id'] ??
    evento.requestContext?.requestId ??
    contexto?.awsRequestId ??
    'sem-correlacao'
  );
}

function extrairCpf(evento: APIGatewayProxyEventV2): string | undefined {
  if (!evento.body) return undefined;
  const bruto = evento.isBase64Encoded
    ? Buffer.from(evento.body, 'base64').toString('utf8')
    : evento.body;
  try {
    const corpo = JSON.parse(bruto) as { cpf?: unknown; documento?: unknown };
    const valor = corpo.cpf ?? corpo.documento;
    return typeof valor === 'string' ? valor : undefined;
  } catch {
    return undefined;
  }
}

export function criarHandler(dependencias: Dependencias = dependenciasPadrao) {
  return async function handler(
    evento: APIGatewayProxyEventV2,
    contexto?: Context,
  ): Promise<APIGatewayProxyStructuredResultV2> {
    const correlationId = extrairCorrelationId(evento, contexto);
    const inicio = Date.now();

    const cpfInformado = extrairCpf(evento);
    if (!cpfInformado) {
      logger.warn('Requisicao sem CPF no corpo', { correlationId });
      return erro(400, 'Bad Request', 'Informe o CPF no corpo da requisicao: {"cpf": "..."}', correlationId);
    }

    const cpf = normalizarCpf(cpfInformado);
    if (!isCpfValido(cpf)) {
      logger.warn('CPF invalido', { correlationId, cpf: mascararCpf(cpfInformado) });
      return erro(400, 'Bad Request', 'CPF invalido', correlationId);
    }

    try {
      const cliente = await dependencias.repository.buscarPorCpf(cpf);

      if (!cliente) {
        logger.warn('Cliente nao encontrado', { correlationId, cpf: mascararCpf(cpf) });
        return erro(404, 'Not Found', 'Cliente nao encontrado para o CPF informado', correlationId);
      }

      if (!cliente.ativo) {
        logger.warn('Cliente inativo', { correlationId, clienteId: cliente.id });
        return erro(403, 'Forbidden', 'Cliente inativo. Procure a oficina para reativar o cadastro.', correlationId);
      }

      const segredo = await dependencias.obterSegredo();
      const token = await gerarToken(
        { sub: cpf, clienteId: cliente.id, nome: cliente.nome, role: 'CLIENTE' },
        segredo,
      );

      logger.info('Token emitido', {
        correlationId,
        clienteId: cliente.id,
        duracaoMs: Date.now() - inicio,
      });

      return resposta(
        200,
        {
          accessToken: token.accessToken,
          tokenType: 'Bearer',
          expiresIn: token.expiresIn,
          expiresAt: token.expiresAt,
          cliente: { id: cliente.id, nome: cliente.nome, cpf: mascararCpf(cpf) },
        },
        correlationId,
      );
    } catch (causa) {
      logger.error('Falha ao autenticar cliente', {
        correlationId,
        erro: causa instanceof Error ? causa.message : String(causa),
      });
      return erro(500, 'Internal Server Error', 'Falha ao processar a autenticacao', correlationId);
    }
  };
}

export const handler = criarHandler();
