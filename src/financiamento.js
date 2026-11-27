// Cálculos do financiamento imobiliário (SAC e Price).
// Funções puras, sem DOM: são usadas pela página e pelos testes (node --test).

/** Limite de prazo usado pela maioria dos bancos no Brasil: 35 anos. */
export const PRAZO_MAXIMO_MESES = 420;

/** Parte da renda que os bancos costumam aceitar comprometer com a parcela. */
export const COMPROMETIMENTO_RENDA = 0.3;

/**
 * Converte a taxa anual efetiva (em %) para a taxa mensal equivalente (decimal).
 * Ex.: 12,6825% ao ano -> 0,01 (1% ao mês).
 */
export function taxaMensal(taxaAnualPct) {
  return Math.pow(1 + taxaAnualPct / 100, 1 / 12) - 1;
}

/** Parcela fixa da Tabela Price: PMT = PV * i / (1 - (1 + i)^-n). */
export function parcelaPrice(principal, i, meses) {
  if (i === 0) return principal / meses;
  return (principal * i) / (1 - Math.pow(1 + i, -meses));
}

/**
 * Confere os dados do formulário e devolve uma lista de erros em português.
 * Lista vazia = dados válidos.
 */
export function validar({ valorImovel, entrada, prazoMeses, taxaAnual, extraMensal = 0, encargosMensais = 0 }) {
  const erros = [];
  const numero = (v) => typeof v === 'number' && Number.isFinite(v);

  if (!numero(valorImovel) || valorImovel <= 0) erros.push('Informe o valor do imóvel.');
  if (!numero(entrada) || entrada < 0) erros.push('A entrada não pode ser negativa.');
  else if (numero(valorImovel) && entrada >= valorImovel) erros.push('A entrada precisa ser menor que o valor do imóvel.');
  if (!numero(prazoMeses) || !Number.isInteger(prazoMeses) || prazoMeses < 1) erros.push('O prazo precisa ter pelo menos 1 mês.');
  else if (prazoMeses > PRAZO_MAXIMO_MESES) erros.push('O prazo máximo é de 35 anos (420 meses).');
  if (!numero(taxaAnual) || taxaAnual < 0) erros.push('A taxa de juros não pode ser negativa.');
  else if (taxaAnual > 100) erros.push('Confira a taxa: ela deve ser anual, em %.');
  if (!numero(extraMensal) || extraMensal < 0) erros.push('A amortização extra não pode ser negativa.');
  if (!numero(encargosMensais) || encargosMensais < 0) erros.push('Seguros e taxas não podem ser negativos.');

  return erros;
}

/**
 * Gera a tabela mês a mês de um financiamento.
 * - sistema: 'SAC' (amortização constante, parcela cai) ou 'PRICE' (parcela fixa)
 * - extraMensal: valor pago a mais todo mês, abatido do saldo (reduz o prazo)
 * - encargosMensais: seguros e taxas somados à parcela enquanto houver saldo
 */
export function simular({ principal, taxaAnual, meses, sistema, extraMensal = 0, encargosMensais = 0 }) {
  if (sistema !== 'SAC' && sistema !== 'PRICE') throw new Error(`Sistema desconhecido: ${sistema}`);
  if (!(principal > 0)) throw new Error('O valor financiado precisa ser maior que zero.');

  const i = taxaMensal(taxaAnual);
  const amortizacaoSac = principal / meses;
  const pmt = parcelaPrice(principal, i, meses);

  const linhas = [];
  let saldo = principal;

  for (let mes = 1; mes <= meses && saldo > 0; mes++) {
    const juros = saldo * i;
    let amortizacao = sistema === 'SAC' ? amortizacaoSac : pmt - juros;
    // No último mês do contrato (ou se sobrar menos que a parcela), quita o que falta.
    if (mes === meses || amortizacao > saldo) amortizacao = saldo;
    const extra = Math.min(extraMensal, saldo - amortizacao);

    saldo -= amortizacao + extra;
    if (saldo < 0.005) saldo = 0;

    const parcela = juros + amortizacao + encargosMensais;
    linhas.push({ mes, parcela, juros, amortizacao, extra, encargos: encargosMensais, saldo });
  }

  const soma = (campo) => linhas.reduce((t, l) => t + l[campo], 0);
  const totalJuros = soma('juros');
  const totalEncargos = soma('encargos');
  const totalExtra = soma('extra');
  const totalPago = soma('parcela') + totalExtra;

  return {
    sistema,
    principal,
    taxaMensal: i,
    linhas,
    mesesParaQuitar: linhas.length,
    primeiraParcela: linhas[0].parcela,
    ultimaParcela: linhas[linhas.length - 1].parcela,
    maiorParcela: Math.max(...linhas.map((l) => l.parcela)),
    totalJuros,
    totalEncargos,
    totalExtra,
    totalPago,
  };
}

/** Saldo devedor depois de um certo mês (mês 0 = início, saldo = valor financiado). */
export function saldoNoMes(resultado, mes) {
  if (mes <= 0) return resultado.principal;
  if (mes >= resultado.linhas.length) return 0;
  return resultado.linhas[mes - 1].saldo;
}

/**
 * Quanto do imóvel já é seu num certo mês, de 0 a 1:
 * (entrada + parte do financiamento já amortizada) / valor do imóvel.
 */
export function fracaoQuitada(resultado, mes, entrada, valorImovel) {
  const amortizado = resultado.principal - saldoNoMes(resultado, mes);
  return (entrada + amortizado) / valorImovel;
}

/** Renda mensal mínima para a parcela caber em 30% da renda. */
export function rendaMinima(parcela, comprometimento = COMPROMETIMENTO_RENDA) {
  return parcela / comprometimento;
}

/** Simula SAC e Price com os mesmos dados e devolve as diferenças principais. */
export function comparar(dados) {
  const principal = dados.valorImovel - dados.entrada;
  const base = {
    principal,
    taxaAnual: dados.taxaAnual,
    meses: dados.prazoMeses,
    extraMensal: dados.extraMensal ?? 0,
    encargosMensais: dados.encargosMensais ?? 0,
  };
  const sac = simular({ ...base, sistema: 'SAC' });
  const price = simular({ ...base, sistema: 'PRICE' });
  return {
    sac,
    price,
    economiaJurosSac: price.totalJuros - sac.totalJuros,
    diferencaPrimeiraParcela: sac.primeiraParcela - price.primeiraParcela,
  };
}

/** Resume a tabela por ano: total pago, juros, amortização e saldo no fim do ano. */
export function resumoAnual(resultado) {
  const anos = [];
  for (const l of resultado.linhas) {
    const ano = Math.ceil(l.mes / 12);
    if (!anos[ano - 1]) anos[ano - 1] = { ano, pago: 0, juros: 0, amortizacao: 0, saldo: 0 };
    const a = anos[ano - 1];
    a.pago += l.parcela + l.extra;
    a.juros += l.juros;
    a.amortizacao += l.amortizacao + l.extra;
    a.saldo = l.saldo;
  }
  return anos;
}
