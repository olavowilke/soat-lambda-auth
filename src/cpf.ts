/**
 * Validacao de CPF (digitos verificadores).
 *
 * Regra identica a implementada no dominio da aplicacao
 * (`br.com.oficina.cliente.entities.Documento#isValidCPF`), replicada aqui de
 * proposito: a Lambda precisa rejeitar CPF invalido *antes* de tocar o banco,
 * e nao deve depender de um artefato Java.
 */

/** Remove tudo que nao for digito. */
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Formata como 000.000.000-00 (apenas para exibicao/logs mascarados). */
export function mascararCpf(cpf: string): string {
  const digitos = normalizarCpf(cpf);
  if (digitos.length !== 11) return '***';
  return `${digitos.slice(0, 3)}.***.***-${digitos.slice(9)}`;
}

function digitoVerificador(digitos: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < pesoInicial - 1; i++) {
    soma += Number(digitos[i]) * (pesoInicial - i);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function isCpfValido(valor: string | undefined | null): boolean {
  if (!valor) return false;
  const digitos = normalizarCpf(valor);
  if (digitos.length !== 11) return false;
  // Sequencias repetidas (111.111.111-11) passam no calculo, mas nao existem.
  if (new Set(digitos).size === 1) return false;

  if (digitoVerificador(digitos, 10) !== Number(digitos[9])) return false;
  return digitoVerificador(digitos, 11) === Number(digitos[10]);
}
