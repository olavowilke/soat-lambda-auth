/**
 * Log estruturado em JSON (uma linha por evento), no formato que o CloudWatch
 * encaminha ao New Relic. `correlationId` amarra a requisicao ao trace da API.
 */
type Nivel = 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  correlationId?: string;
  [chave: string]: unknown;
}

function emitir(nivel: Nivel, mensagem: string, contexto: LogContext = {}): void {
  const linha = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: nivel,
    service: process.env.SERVICE_NAME ?? 'lambda-auth',
    environment: process.env.ENVIRONMENT ?? 'local',
    message: mensagem,
    ...contexto,
  });
  if (nivel === 'ERROR') console.error(linha);
  else if (nivel === 'WARN') console.warn(linha);
  else console.log(linha);
}

export const logger = {
  info: (mensagem: string, contexto?: LogContext) => emitir('INFO', mensagem, contexto),
  warn: (mensagem: string, contexto?: LogContext) => emitir('WARN', mensagem, contexto),
  error: (mensagem: string, contexto?: LogContext) => emitir('ERROR', mensagem, contexto),
};
