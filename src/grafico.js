// Gráfico de linhas em SVG, sem biblioteca: duas séries (SAC e Price) ao longo dos meses,
// com eixo único, rótulos diretos, legenda, linha do mês escolhido e dica ao passar o mouse.

const NS = 'http://www.w3.org/2000/svg';

function el(nome, attrs = {}, pai) {
  const n = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (pai) pai.appendChild(n);
  return n;
}

/** Marcas "redondas" para o eixo: 1, 2, 2,5 ou 5 vezes uma potência de 10. */
function marcasEixo(max, alvo = 4) {
  if (max <= 0) return [0, 1];
  const bruto = max / alvo;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto);
  const marcas = [];
  for (let v = 0; v <= max + passo * 0.001; v += passo) marcas.push(v);
  if (marcas.at(-1) < max) marcas.push(marcas.at(-1) + passo);
  return marcas;
}

/**
 * opcoes:
 *  - series: [{ nome, classe, valores: number[] }]  (valores[k] = mês k + 1)
 *  - formatoEixo(v), formatoValor(v): textos em R$
 *  - mesInicial: começa em 0 (saldo) ou 1 (parcelas)
 */
export function criarGrafico(container, opcoes) {
  const svg = el('svg', { class: 'grafico-svg', role: 'img' });
  container.appendChild(svg);
  const dica = document.createElement('div');
  dica.className = 'grafico-dica';
  dica.hidden = true;
  container.appendChild(dica);

  let dados = opcoes;
  let mesMarcado = null;
  let escala = null;

  function desenhar() {
    const W = Math.max(300, container.clientWidth);
    const H = W < 520 ? 230 : 270;
    const m = { esq: W < 520 ? 58 : 70, dir: 16, topo: 14, base: 30 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', dados.descricao || '');
    svg.replaceChildren();

    const inicio = dados.mesInicial ?? 1;
    const n = Math.max(...dados.series.map((s) => s.valores.length));
    const ultimoMes = inicio + n - 1;
    const maxY = Math.max(...dados.series.flatMap((s) => s.valores));
    const marcasY = marcasEixo(maxY);
    const topoY = marcasY.at(-1);
    const x = (mes) => m.esq + ((mes - inicio) / Math.max(1, ultimoMes - inicio)) * (W - m.esq - m.dir);
    const y = (v) => H - m.base - (v / topoY) * (H - m.topo - m.base);
    escala = { x, y, inicio, ultimoMes, m, W, H };

    // grade e eixo Y
    const gGrade = el('g', { class: 'grafico-grade' }, svg);
    for (const v of marcasY) {
      el('line', { x1: m.esq, x2: W - m.dir, y1: y(v), y2: y(v) }, gGrade);
      const t = el('text', { x: m.esq - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'grafico-eixo' }, svg);
      t.textContent = dados.formatoEixo(v);
    }
    // eixo X em anos
    const anos = Math.ceil(ultimoMes / 12);
    // quantos rótulos cabem sem encostar (~60px cada) e passo "redondo" de anos
    const cabem = Math.max(2, Math.floor((W - m.esq - m.dir) / 60));
    const passoAnos = [1, 2, 5, 10, 15].find((p) => anos / p <= cabem) ?? 20;
    for (let a = passoAnos; a <= anos; a += passoAnos) {
      const mes = a * 12;
      if (mes > ultimoMes) break;
      const t = el('text', { x: x(mes), y: H - 8, 'text-anchor': 'middle', class: 'grafico-eixo' }, svg);
      t.textContent = `ano ${a}`;
    }

    // mês escolhido na linha do tempo
    const gMarca = el('g', { class: 'grafico-marca' }, svg);
    if (mesMarcado != null && mesMarcado >= inicio && mesMarcado <= ultimoMes) {
      el('line', { x1: x(mesMarcado), x2: x(mesMarcado), y1: m.topo, y2: H - m.base }, gMarca);
    }

    // linhas
    for (const s of dados.series) {
      const d = s.valores.map((v, k) => `${k ? 'L' : 'M'}${x(inicio + k).toFixed(1)},${y(v).toFixed(1)}`).join('');
      el('path', { d, class: `grafico-linha ${s.classe}` }, svg);
    }

    // rótulos diretos num ponto onde as linhas estão separadas
    const k = Math.floor(n * 0.42);
    const pts = dados.series.map((s) => ({ s, v: s.valores[Math.min(k, s.valores.length - 1)] ?? 0 }));
    const ordem = [...pts].sort((a, b) => b.v - a.v);
    ordem.forEach((p, idx) => {
      const t = el('text', {
        x: x(inicio + k),
        y: y(p.v) + (idx === 0 ? -10 : 20),
        'text-anchor': 'middle',
        class: `grafico-rotulo ${p.s.classe}`,
      }, svg);
      t.textContent = p.s.nome;
    });

    // crosshair
    const gHover = el('g', { class: 'grafico-hover', visibility: 'hidden' }, svg);
    el('line', { y1: m.topo, y2: H - m.base, class: 'grafico-cruz' }, gHover);
    for (const s of dados.series) el('circle', { r: 4.5, class: `grafico-ponto ${s.classe}` }, gHover);
    const area = el('rect', { x: m.esq, y: m.topo, width: W - m.esq - m.dir, height: H - m.topo - m.base, fill: 'transparent' }, svg);

    const mostrar = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      const mes = Math.round(inicio + ((px - m.esq) / (W - m.esq - m.dir)) * (ultimoMes - inicio));
      const mm = Math.min(ultimoMes, Math.max(inicio, mes));
      gHover.setAttribute('visibility', 'visible');
      gHover.querySelector('line').setAttribute('x1', x(mm));
      gHover.querySelector('line').setAttribute('x2', x(mm));
      const linhas = dados.series.map((s, i) => {
        const v = s.valores[mm - inicio] ?? 0;
        const c = gHover.querySelectorAll('circle')[i];
        c.setAttribute('cx', x(mm));
        c.setAttribute('cy', y(v));
        return `<div class="dica-linha"><span class="dica-cor ${s.classe}"></span>${s.nome}<b>${dados.formatoValor(v)}</b></div>`;
      });
      const ano = Math.max(1, Math.ceil(mm / 12));
      dica.innerHTML = `<div class="dica-titulo">Mês ${mm} · ano ${ano}</div>${linhas.join('')}`;
      dica.hidden = false;
      const larg = dica.offsetWidth;
      const cx = (x(mm) / W) * r.width;
      dica.style.left = `${Math.min(r.width - larg - 4, Math.max(4, cx + 14))}px`;
    };
    area.addEventListener('pointermove', (e) => mostrar(e.clientX));
    area.addEventListener('pointerdown', (e) => mostrar(e.clientX));
    area.addEventListener('pointerleave', () => { gHover.setAttribute('visibility', 'hidden'); dica.hidden = true; });
  }

  new ResizeObserver(() => desenhar()).observe(container);

  return {
    atualizar(novos) { dados = { ...dados, ...novos }; desenhar(); },
    marcarMes(mes) {
      mesMarcado = mes;
      const linha = svg.querySelector('.grafico-marca');
      if (!escala || !linha) return;
      linha.replaceChildren();
      if (mes >= escala.inicio && mes <= escala.ultimoMes) {
        el('line', { x1: escala.x(mes), x2: escala.x(mes), y1: escala.m.topo, y2: escala.H - escala.m.base }, linha);
      }
    },
  };
}
