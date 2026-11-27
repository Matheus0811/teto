import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  taxaMensal, parcelaPrice, simular, validar, comparar,
  saldoNoMes, fracaoQuitada, rendaMinima, resumoAnual,
} from '../src/financiamento.js';

const perto = (real, esperado, casas = 2) =>
  assert.ok(Math.abs(real - esperado) < 10 ** -casas, `esperado ${esperado}, veio ${real}`);

// 12,6825...% ao ano equivale a exatamente 1% ao mês.
const TAXA_1_AO_MES = (Math.pow(1.01, 12) - 1) * 100;
const exemplo = { principal: 100000, taxaAnual: TAXA_1_AO_MES, meses: 12 };

test('converte taxa anual em taxa mensal equivalente', () => {
  perto(taxaMensal(TAXA_1_AO_MES), 0.01, 10);
  perto(taxaMensal(0), 0, 10);
});

test('parcela da Tabela Price confere com a fórmula', () => {
  perto(parcelaPrice(100000, 0.01, 12), 8884.88);
  perto(parcelaPrice(1200, 0, 12), 100); // sem juros, divide igual
});

test('SAC: amortização constante e parcela que cai', () => {
  const r = simular({ ...exemplo, sistema: 'SAC' });
  assert.equal(r.linhas.length, 12);
  perto(r.primeiraParcela, 9333.33);
  perto(r.ultimaParcela, 8416.67);
  perto(r.totalJuros, 6500); // i * P * (n + 1) / 2
  for (const l of r.linhas) perto(l.amortizacao, 8333.33);
  assert.equal(r.linhas.at(-1).saldo, 0);
});

test('Price: parcela fixa e juros totais maiores que no SAC', () => {
  const r = simular({ ...exemplo, sistema: 'PRICE' });
  for (const l of r.linhas) perto(l.parcela, 8884.88);
  perto(r.totalJuros, 6618.55);
  perto(r.linhas.reduce((t, l) => t + l.amortizacao, 0), 100000);
  assert.equal(r.linhas.at(-1).saldo, 0);
});

test('Price começa amortizando pouco e termina amortizando muito', () => {
  const r = simular({ principal: 300000, taxaAnual: 11, meses: 360, sistema: 'PRICE' });
  assert.ok(r.linhas[0].amortizacao < r.linhas[0].juros);
  assert.ok(r.linhas.at(-1).amortizacao > r.linhas.at(-1).juros);
});

test('amortização extra reduz o prazo e os juros nos dois sistemas', () => {
  for (const sistema of ['SAC', 'PRICE']) {
    const sem = simular({ principal: 300000, taxaAnual: 11, meses: 360, sistema });
    const com = simular({ principal: 300000, taxaAnual: 11, meses: 360, sistema, extraMensal: 500 });
    assert.ok(com.mesesParaQuitar < sem.mesesParaQuitar, sistema);
    assert.ok(com.totalJuros < sem.totalJuros, sistema);
    assert.equal(com.linhas.at(-1).saldo, 0);
    const amortizado = com.linhas.reduce((t, l) => t + l.amortizacao + l.extra, 0);
    perto(amortizado, 300000);
  }
});

test('seguros e taxas entram no total pago, mas não nos juros', () => {
  const sem = simular({ ...exemplo, sistema: 'SAC' });
  const com = simular({ ...exemplo, sistema: 'SAC', encargosMensais: 50 });
  perto(com.totalJuros, sem.totalJuros);
  perto(com.totalPago - sem.totalPago, 600);
  perto(com.primeiraParcela - sem.primeiraParcela, 50);
});

test('comparar: SAC paga menos juros e começa com parcela maior', () => {
  const c = comparar({ valorImovel: 400000, entrada: 80000, prazoMeses: 360, taxaAnual: 11.5 });
  assert.ok(c.economiaJurosSac > 0);
  assert.ok(c.diferencaPrimeiraParcela > 0);
  perto(c.sac.principal, 320000);
});

test('saldo e fração quitada ao longo do tempo', () => {
  const r = simular({ ...exemplo, sistema: 'SAC' });
  assert.equal(saldoNoMes(r, 0), 100000);
  perto(saldoNoMes(r, 6), 50000);
  assert.equal(saldoNoMes(r, 12), 0);
  // imóvel de 125 mil com 25 mil de entrada: começa 20% seu, termina 100%
  perto(fracaoQuitada(r, 0, 25000, 125000), 0.2);
  perto(fracaoQuitada(r, 6, 25000, 125000), 0.6);
  perto(fracaoQuitada(r, 12, 25000, 125000), 1);
});

test('renda mínima para a parcela caber em 30% da renda', () => {
  perto(rendaMinima(3000), 10000);
});

test('resumo anual soma os 12 meses de cada ano', () => {
  const r = simular({ principal: 120000, taxaAnual: 10, meses: 24, sistema: 'SAC' });
  const anos = resumoAnual(r);
  assert.equal(anos.length, 2);
  perto(anos[0].amortizacao, 60000);
  perto(anos[0].saldo, 60000);
  assert.equal(anos[1].saldo, 0);
});

test('validação explica o que está errado', () => {
  const ok = { valorImovel: 400000, entrada: 80000, prazoMeses: 360, taxaAnual: 11.5 };
  assert.deepEqual(validar(ok), []);
  assert.match(validar({ ...ok, entrada: 400000 })[0], /menor que o valor/);
  assert.match(validar({ ...ok, prazoMeses: 480 })[0], /35 anos/);
  assert.match(validar({ ...ok, taxaAnual: -1 })[0], /negativa/);
  assert.match(validar({ ...ok, valorImovel: NaN })[0], /valor do imóvel/);
});

test('sem juros, as duas tabelas pagam só o valor financiado', () => {
  for (const sistema of ['SAC', 'PRICE']) {
    const r = simular({ principal: 1200, taxaAnual: 0, meses: 12, sistema });
    perto(r.totalJuros, 0);
    perto(r.totalPago, 1200);
  }
});
