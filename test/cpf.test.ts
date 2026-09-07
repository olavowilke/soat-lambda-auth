import { describe, expect, it } from 'vitest';
import { isCpfValido, mascararCpf, normalizarCpf } from '../src/cpf.ts';

describe('normalizarCpf', () => {
  it('remove mascara e mantem apenas digitos', () => {
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725');
  });
});

describe('isCpfValido', () => {
  it.each(['52998224725', '529.982.247-25', '11144477735'])('aceita CPF valido %s', (cpf) => {
    expect(isCpfValido(cpf)).toBe(true);
  });

  it('rejeita CPF com digito verificador errado', () => {
    expect(isCpfValido('52998224724')).toBe(false);
  });

  it('rejeita CPF com todos os digitos iguais', () => {
    expect(isCpfValido('11111111111')).toBe(false);
  });

  it.each([['tamanho errado', '1234567890'], ['vazio', ''], ['letras', 'abcdefghijk']])(
    'rejeita %s',
    (_caso, cpf) => {
      expect(isCpfValido(cpf)).toBe(false);
    },
  );

  it('rejeita nulo e indefinido', () => {
    expect(isCpfValido(null)).toBe(false);
    expect(isCpfValido(undefined)).toBe(false);
  });
});

describe('mascararCpf', () => {
  it('expoe apenas os tres primeiros e os dois ultimos digitos', () => {
    expect(mascararCpf('52998224725')).toBe('529.***.***-25');
  });

  it('nao vaza valor quando o CPF tem tamanho invalido', () => {
    expect(mascararCpf('123')).toBe('***');
  });
});
