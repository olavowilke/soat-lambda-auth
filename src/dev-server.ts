/**
 * Servidor HTTP local que expoe o mesmo handler da Lambda.
 *
 * Permite exercitar o fluxo ponta a ponta sem AWS: aponte DB_* para o Postgres
 * do `docker compose` da aplicacao e use o mesmo JWT_SECRET da API.
 *
 *   JWT_SECRET=... DB_SSL=false npm run dev
 *   curl -X POST localhost:3000/auth/token -d '{"cpf":"52998224725"}'
 */
import { createServer, type IncomingMessage } from 'node:http';
import { handler } from './handler.ts';
import { handler as authorizer } from './authorizer.ts';
import { encerrarPool } from './clienteRepository.ts';
import { logger } from './logger.ts';

const PORTA = Number(process.env.PORT ?? 3000);

async function lerCorpo(requisicao: IncomingMessage): Promise<string> {
  const partes: Buffer[] = [];
  for await (const parte of requisicao) partes.push(parte as Buffer);
  return Buffer.concat(partes).toString('utf8');
}

const servidor = createServer((requisicao, resposta) => {
  void (async () => {
    const url = new URL(requisicao.url ?? '/', `http://localhost:${PORTA}`);
    const corpo = await lerCorpo(requisicao);
    const cabecalhos = Object.fromEntries(
      Object.entries(requisicao.headers).map(([chave, valor]) => [chave, String(valor ?? '')]),
    );

    if (url.pathname === '/health') {
      resposta.writeHead(200, { 'content-type': 'application/json' });
      resposta.end(JSON.stringify({ status: 'UP' }));
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evento: any = {
      version: '2.0',
      routeKey: `${requisicao.method} ${url.pathname}`,
      rawPath: url.pathname,
      headers: cabecalhos,
      body: corpo || undefined,
      isBase64Encoded: false,
      requestContext: { requestId: `local-${Date.now()}`, http: { method: requisicao.method } },
    };

    if (url.pathname === '/auth/authorize') {
      const resultado = await authorizer(evento);
      resposta.writeHead(200, { 'content-type': 'application/json' });
      resposta.end(JSON.stringify(resultado));
      return;
    }

    const resultado = await handler(evento);
    resposta.writeHead(resultado.statusCode ?? 500, resultado.headers as Record<string, string>);
    resposta.end(resultado.body ?? '');
  })().catch((causa: unknown) => {
    logger.error('Falha no servidor local', { erro: String(causa) });
    resposta.writeHead(500).end();
  });
});

servidor.listen(PORTA, () => logger.info(`Servidor local em http://localhost:${PORTA}`));

process.on('SIGINT', () => {
  void encerrarPool().finally(() => servidor.close(() => process.exit(0)));
});
