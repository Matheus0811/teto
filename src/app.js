// Liga o formulário, a cena 3D, os gráficos e a tabela aos cálculos.
import { comparar, validar, fracaoQuitada, saldoNoMes, rendaMinima, resumoAnual, taxaMensal } from './financiamento.js';
import { criarGrafico } from './grafico.js';

const $ = (s) => document.querySelector(s);
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const pct2 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "400.000,50" -> 400000.5 ; na taxa, "11.5" também vale como 11,5 */
function lerNumero(texto, { pontoDecimal = false } = {}) {
  let s = String(texto).replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (!pontoDecimal) s = s.replace(/\./g, '');
  return s === '' ? NaN : Number(s);
}

function compacto(v) {
  if (v === 0) return 'R$ 0';
  if (v >= 1e6) return `R$ ${num.format(Math.round(v / 1e5) / 10)} mi`;
  if (v >= 1000) return `R$ ${num.format(Math.round(v / 100) / 10)} mil`;
  return brl0.format(v);
}

function duracao(meses) {
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  const ta = a ? `${a} ${a === 1 ? 'ano' : 'anos'}` : '';
  const tm = m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '';
  return [ta, tm].filter(Boolean).join(' e ');
}

// ---------- estado ----------
const campos = {
  valor: $('#valor-imovel'),
  entrada: $('#entrada'),
  entradaPct: $('#entrada-pct'),
  prazo: $('#prazo'),
  taxa: $('#taxa'),
  encargos: $('#encargos'),
  extra: $('#extra'),
};
let resultado = null;
let dados = null;
let mesAtual = null;
let cena = null;
let sistemaTabela = 'SAC';
let modoTabela = 'ano';

function lerFormulario() {
  return {
    valorImovel: lerNumero(campos.valor.value),
    entrada: lerNumero(campos.entrada.value),
    prazoMeses: Number(campos.prazo.value) * 12,
    taxaAnual: lerNumero(campos.taxa.value, { pontoDecimal: true }),
    encargosMensais: lerNumero(campos.encargos.value || '0'),
    extraMensal: lerNumero(campos.extra.value || '0'),
  };
}

// ---------- gráficos ----------
const graficoParcela = criarGrafico($('#grafico-parcela'), {
  series: [],
  mesInicial: 1,
  formatoEixo: compacto,
  formatoValor: (v) => brl.format(v),
  descricao: 'Valor da parcela mês a mês no SAC e na Price',
});
const graficoSaldo = criarGrafico($('#grafico-saldo'), {
  series: [],
  mesInicial: 0,
  formatoEixo: compacto,
  formatoValor: (v) => brl.format(v),
  descricao: 'Saldo devedor mês a mês no SAC e na Price',
});

// ---------- cálculo ----------
function calcular() {
  dados = lerFormulario();
  const erros = validar(dados);
  const caixaErros = $('#erros');
  caixaErros.hidden = erros.length === 0;
  caixaErros.innerHTML = erros.map((e) => `<li>${e}</li>`).join('');
  document.body.classList.toggle('com-erro', erros.length > 0);

  $('#prazo-saida').textContent = `${campos.prazo.value} anos · ${dados.prazoMeses} meses`;
  if (Number.isFinite(dados.taxaAnual) && dados.taxaAnual >= 0) {
    $('#taxa-mensal').textContent = `≈ ${pct2.format(taxaMensal(dados.taxaAnual))} ao mês`;
  }
  if (Number.isFinite(dados.valorImovel) && dados.valorImovel > 0 && Number.isFinite(dados.entrada)) {
    $('#entrada-pct-saida').textContent = `${pct.format(dados.entrada / dados.valorImovel)} do imóvel`;
  }
  if (erros.length) return;

  resultado = comparar(dados);
  renderizarComparacao();
  renderizarGraficos();
  renderizarTabela();

  const max = Math.max(resultado.sac.mesesParaQuitar, resultado.price.mesesParaQuitar);
  const tempo = $('#tempo');
  tempo.max = String(max);
  if (mesAtual == null) mesAtual = Math.round(max / 3);
  mesAtual = Math.min(mesAtual, max);
  tempo.value = String(mesAtual);
  atualizarTempo();
  pintarSliders();
}

function renderizarComparacao() {
  const { sac, price, economiaJurosSac, diferencaPrimeiraParcela } = resultado;
  const veredito = $('#veredito');
  if (economiaJurosSac > 1) {
    veredito.innerHTML = `No SAC, você paga <strong>${brl0.format(economiaJurosSac)}</strong> a menos de juros.`;
    $('#veredito-detalhe').textContent = diferencaPrimeiraParcela > 1
      ? `Em troca, a primeira parcela do SAC é ${brl0.format(diferencaPrimeiraParcela)} maior. Na Price, a parcela começa menor e fica igual até o fim.`
      : 'Na Price, a parcela fica igual do começo ao fim.';
  } else {
    veredito.textContent = 'Sem juros, os dois sistemas custam o mesmo.';
    $('#veredito-detalhe').textContent = 'A diferença entre SAC e Price vem dos juros sobre o saldo devedor.';
  }

  for (const [r, id] of [[sac, 'sac'], [price, 'price']]) {
    const card = $(`#card-${id}`);
    const valores = {
      primeira: brl.format(r.primeiraParcela),
      ultima: brl.format(r.ultimaParcela),
      juros: brl0.format(r.totalJuros),
      total: brl0.format(r.totalPago),
      prazo: duracao(r.mesesParaQuitar),
      renda: brl0.format(rendaMinima(r.maiorParcela)),
    };
    for (const [k, v] of Object.entries(valores)) card.querySelector(`[data-v="${k}"]`).textContent = v;
  }
  const menosJuros = sac.totalJuros <= price.totalJuros ? 'sac' : 'price';
  const parcelaMenor = sac.primeiraParcela <= price.primeiraParcela ? 'sac' : 'price';
  $('#selo-juros-sac').hidden = menosJuros !== 'sac' || Math.abs(resultado.economiaJurosSac) < 1;
  $('#selo-juros-price').hidden = menosJuros !== 'price' || Math.abs(resultado.economiaJurosSac) < 1;
  $('#selo-parcela-sac').hidden = parcelaMenor !== 'sac' || Math.abs(diferencaPrimeiraParcela) < 1;
  $('#selo-parcela-price').hidden = parcelaMenor !== 'price' || Math.abs(diferencaPrimeiraParcela) < 1;

  const extra = dados.extraMensal > 0;
  $('#nota-extra').hidden = !extra;
  if (extra) {
    $('#nota-extra').textContent = `Com ${brl0.format(dados.extraMensal)} a mais por mês, o SAC termina em ${duracao(sac.mesesParaQuitar)} e a Price em ${duracao(price.mesesParaQuitar)}, em vez de ${duracao(dados.prazoMeses)}.`;
  }
}

function renderizarGraficos() {
  const { sac, price } = resultado;
  graficoParcela.atualizar({
    series: [
      { nome: 'SAC', classe: 's-sac', valores: sac.linhas.map((l) => l.parcela) },
      { nome: 'Price', classe: 's-price', valores: price.linhas.map((l) => l.parcela) },
    ],
  });
  graficoSaldo.atualizar({
    series: [
      { nome: 'SAC', classe: 's-sac', valores: [sac.principal, ...sac.linhas.map((l) => l.saldo)] },
      { nome: 'Price', classe: 's-price', valores: [price.principal, ...price.linhas.map((l) => l.saldo)] },
    ],
  });
}

// ---------- linha do tempo ----------
function atualizarTempo() {
  if (!resultado) return;
  mesAtual = Number($('#tempo').value);
  const { sac, price } = resultado;
  const fEntrada = dados.entrada / dados.valorImovel;
  const fSac = fracaoQuitada(sac, mesAtual, dados.entrada, dados.valorImovel);
  const fPrice = fracaoQuitada(price, mesAtual, dados.entrada, dados.valorImovel);

  $('#tempo-saida').textContent = mesAtual === 0 ? 'Assinatura do contrato' : `Mês ${mesAtual} · ano ${Math.ceil(mesAtual / 12)}`;
  $('#tempo').setAttribute('aria-valuetext', $('#tempo-saida').textContent);
  for (const [id, f, r] of [['sac', fSac, sac], ['price', fPrice, price]]) {
    const txt = pct.format(f);
    $(`#rotulo-${id} .rotulo-pct`).textContent = txt;
    $(`#leitura-${id} .leitura-pct`).textContent = `${txt} seu`;
    $(`#leitura-${id} .leitura-saldo`).textContent = `faltam ${brl0.format(saldoNoMes(r, mesAtual))}`;
    $(`#barra-${id}`).style.setProperty('--f', f.toFixed(4));
  }
  $('#cena').style.setProperty('--frac-entrada', fEntrada.toFixed(4));
  cena?.atualizar({ entrada: fEntrada, sac: fSac, price: fPrice });
  graficoParcela.marcarMes(mesAtual);
  graficoSaldo.marcarMes(mesAtual);
}

let tocando = null;
function alternarPlay() {
  const tempo = $('#tempo');
  const botao = $('#play');
  if (tocando) {
    cancelAnimationFrame(tocando);
    tocando = null;
    botao.setAttribute('aria-pressed', 'false');
    botao.querySelector('span').textContent = 'Ver o tempo passar';
    return;
  }
  const max = Number(tempo.max);
  if (Number(tempo.value) >= max) tempo.value = '0';
  const inicio = performance.now();
  const de = Number(tempo.value);
  const duracaoMs = 7000 * ((max - de) / max);
  botao.setAttribute('aria-pressed', 'true');
  botao.querySelector('span').textContent = 'Pausar';
  const passo = (agora) => {
    const t = Math.min(1, (agora - inicio) / duracaoMs);
    tempo.value = String(Math.round(de + (max - de) * t));
    atualizarTempo();
    pintarSliders();
    if (t < 1) tocando = requestAnimationFrame(passo);
    else { tocando = null; alternarPlay.parar(); }
  };
  tocando = requestAnimationFrame(passo);
}
alternarPlay.parar = () => {
  const botao = $('#play');
  botao.setAttribute('aria-pressed', 'false');
  botao.querySelector('span').textContent = 'Ver o tempo passar';
};

// ---------- tabela ----------
function linhasTabela() {
  const r = sistemaTabela === 'SAC' ? resultado.sac : resultado.price;
  if (modoTabela === 'ano') {
    return {
      cabecalho: ['Ano', 'Pago no ano', 'Juros', 'Amortização', 'Saldo no fim do ano'],
      linhas: resumoAnual(r).map((a) => [a.ano, a.pago, a.juros, a.amortizacao, a.saldo]),
    };
  }
  const temExtra = r.totalExtra > 0;
  return {
    cabecalho: ['Mês', 'Parcela', 'Juros', 'Amortização', ...(temExtra ? ['Extra'] : []), 'Saldo devedor'],
    linhas: r.linhas.map((l) => [l.mes, l.parcela, l.juros, l.amortizacao, ...(temExtra ? [l.extra] : []), l.saldo]),
  };
}

function renderizarTabela() {
  const { cabecalho, linhas } = linhasTabela();
  const th = cabecalho.map((c) => `<th scope="col">${c}</th>`).join('');
  const corpo = linhas.map((l) => `<tr>${l.map((v, i) => (i === 0 ? `<th scope="row">${v}</th>` : `<td>${brl.format(v)}</td>`)).join('')}</tr>`).join('');
  const legenda = `${sistemaTabela === 'SAC' ? 'SAC' : 'Price'}, ${modoTabela === 'ano' ? 'resumo por ano' : 'mês a mês'} (valores em R$)`;
  $('#tabela-el').innerHTML = `<caption id="tabela-legenda">${legenda}</caption><thead><tr>${th}</tr></thead><tbody>${corpo}</tbody>`;
}

async function copiarTabela() {
  const { cabecalho, linhas } = linhasTabela();
  const tsv = [cabecalho, ...linhas.map((l) => l.map((v, i) => (i === 0 ? v : num.format(Math.round(v * 100) / 100))))]
    .map((l) => l.join('\t')).join('\n');
  const aviso = $('#copia-aviso');
  try {
    await navigator.clipboard.writeText(tsv);
    aviso.textContent = 'Tabela copiada. Cole no Excel ou no Google Planilhas.';
  } catch {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($('#tabela-el'));
    sel.removeAllRanges();
    sel.addRange(range);
    aviso.textContent = 'Tabela selecionada. Use Ctrl+C para copiar.';
  }
}

// ---------- eventos ----------
function sincronizarEntradaPorPct() {
  const v = lerNumero(campos.valor.value);
  if (!(v > 0)) return;
  campos.entrada.value = num.format(Math.round((v * Number(campos.entradaPct.value)) / 100));
}
function sincronizarPctPorEntrada() {
  const v = lerNumero(campos.valor.value);
  const e = lerNumero(campos.entrada.value);
  if (v > 0 && e >= 0) campos.entradaPct.value = String(Math.round((e / v) * 100));
}
function formatarMoeda(input) {
  const v = lerNumero(input.value);
  if (Number.isFinite(v)) input.value = num.format(v);
}

campos.entradaPct.addEventListener('input', () => { sincronizarEntradaPorPct(); calcular(); });
campos.entrada.addEventListener('input', () => { sincronizarPctPorEntrada(); calcular(); });
campos.valor.addEventListener('input', () => { sincronizarPctPorEntrada(); calcular(); });
for (const c of [campos.prazo, campos.taxa, campos.encargos, campos.extra]) c.addEventListener('input', calcular);
for (const c of [campos.valor, campos.entrada, campos.encargos, campos.extra]) c.addEventListener('blur', () => formatarMoeda(c));
$('#form').addEventListener('submit', (e) => { e.preventDefault(); calcular(); });

$('#tempo').addEventListener('input', atualizarTempo);
$('#play').addEventListener('click', alternarPlay);

for (const b of document.querySelectorAll('[data-sistema]')) {
  b.addEventListener('click', () => {
    sistemaTabela = b.dataset.sistema;
    document.querySelectorAll('[data-sistema]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderizarTabela();
  });
}
for (const b of document.querySelectorAll('[data-modo]')) {
  b.addEventListener('click', () => {
    modoTabela = b.dataset.modo;
    document.querySelectorAll('[data-modo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderizarTabela();
  });
}
$('#copiar').addEventListener('click', copiarTabela);

// Preenchimento dos sliders (Chrome/Edge usam a variável --p no trilho).
function pintarSliders() {
  for (const r of document.querySelectorAll('input[type="range"]')) {
    const p = ((Number(r.value) - Number(r.min)) / (Number(r.max) - Number(r.min))) * 100;
    r.style.setProperty('--p', `${p}%`);
  }
}
document.addEventListener('input', (e) => { if (e.target.type === 'range') pintarSliders(); });

// ---------- início ----------
calcular();
pintarSliders();

const palco = $('#cena');
import('./cena3d.js')
  .then(({ criarCena }) => {
    cena = criarCena(palco, {
      rotulos: { sac: $('#rotulo-sac'), price: $('#rotulo-price') },
      reduzirMovimento,
    });
    palco.classList.add('cena-3d-ok');
    atualizarTempo();
  })
  .catch((erro) => {
    console.warn('Cena 3D indisponível, usando a versão 2D:', erro);
    palco.classList.add('cena-sem-3d');
  });
