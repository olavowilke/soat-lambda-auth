import { afterEach, describe, expect, it, vi } from 'vitest';

const consultar = vi.fn();
const encerrar = vi.fn();
const construtorPool = vi.fn();

vi.mock('pg', () => ({
  Pool: class {
    constructor(config: unknown) {
      construtorPool(config);
    }
    query = consultar;
    end = encerrar;
  },
}));

vi.mock('../src/config.ts', () => ({
  obterConfiguracaoBanco: vi.fn(async () => ({
    host: 'rds.local',
    port: 5432,
    database: 'oficina_db',
    user: 'oficina',
    password: 'segredo',
    ssl: true,
  })),
}));

const { clienteRepository, encerrarPool } = await import('../src/clienteRepository.ts');

afterEach(async () => {
  await encerrarPool();
  consultar.mockReset();
  construtorPool.mockReset();
});

describe('clienteRepository.buscarPorCpf', () => {
  it('devolve o cliente encontrado', async () => {
    consultar.mockResolvedValue({ rows: [{ id: 'c-1', nome: 'Ana', ativo: true }] });

    await expect(clienteRepository.buscarPorCpf('52998224725')).resolves.toEqual({
      id: 'c-1',
      nome: 'Ana',
      ativo: true,
    });

    const [sql, parametros] = consultar.mock.calls[0] as [string, string[]];
    expect(sql).toContain('FROM clientes');
    expect(sql).toContain("tipo_documento = 'CPF'");
    expect(parametros).toEqual(['52998224725']);
  });

  it('devolve null quando nao ha linha', async () => {
    consultar.mockResolvedValue({ rows: [] });

    await expect(clienteRepository.buscarPorCpf('52998224725')).resolves.toBeNull();
  });

  it('reaproveita o mesmo pool entre chamadas', async () => {
    consultar.mockResolvedValue({ rows: [] });

    await clienteRepository.buscarPorCpf('52998224725');
    await clienteRepository.buscarPorCpf('11144477735');

    expect(construtorPool).toHaveBeenCalledTimes(1);
    expect(construtorPool).toHaveBeenCalledWith(expect.objectContaining({ max: 2, ssl: expect.anything() }));
  });
});
