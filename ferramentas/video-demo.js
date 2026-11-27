// Gera o vídeo de demonstração do Teto (1080x1350, para o feed do LinkedIn) a partir da cena 3D real.
// Como usar: abra o site, rode no console
//   const { iniciar } = await import('./ferramentas/video-demo.js'); const R = await iniciar();
//   const r = await R.gravar();            // ou R.gravar({ audio: arrayBufferDoMp3, audioIni: 0.3 })
// O vídeo fica em R.video (Blob MP4). Cada quadro é desenhado em tempo virtual e codificado com WebCodecs,
// então o resultado sai fluido mesmo em computador lento. O cursor do vídeo é desenhado, não é o mouse real.
const URL_BASE = new URL('../', import.meta.url);
const SITE = 'matheus0811.github.io/teto';

export async function iniciar() {
  const { criarCena } = await import(new URL('src/cena3d.js', URL_BASE));
  const F = await import(new URL('src/financiamento.js', URL_BASE));
  await Promise.all(['700 62px Unbounded', '600 20px "IBM Plex Mono"', '600 28px "Instrument Sans"', '400 28px "Instrument Sans"', '700 28px "Instrument Sans"']
    .map((f) => document.fonts.load(f)));
  const R = {};

  // tempo virtual: a cena só anda quando R.passo() é chamado
  let agora = performance.now();
  performance.now = () => agora;
  const fila = [];
  window.requestAnimationFrame = (cb) => { fila.push(cb); return fila.length; };
  R.passo = (dt) => { agora += dt; for (const cb of fila.splice(0)) { try { cb(agora); } catch (e) { console.warn(e); } } };

  // cena fora da tela
  const SY = 265, ALT = 1100;
  const caixa = document.createElement('div');
  Object.assign(caixa.style, { position: 'fixed', left: '0', top: '0', width: '1080px', height: `${ALT}px`, opacity: '0', pointerEvents: 'none', zIndex: '-1' });
  document.body.appendChild(caixa);
  const rotS = document.createElement('div'), rotP = document.createElement('div');
  caixa.append(rotS, rotP);
  const cena = criarCena(caixa, { rotulos: { sac: rotS, price: rotP } });
  const glc = caixa.querySelector('canvas');

  // valores de exemplo da página
  const D = { valorImovel: 400000, entrada: 80000, prazoMeses: 360, taxaAnual: 11.5 };
  const res = F.comparar(D);
  const fE = D.entrada / D.valorImovel;
  R.res = res;
  R.estado = (mes) => ({
    mes,
    sac: F.fracaoQuitada(res.sac, mes, D.entrada, D.valorImovel),
    price: F.fracaoQuitada(res.price, mes, D.entrada, D.valorImovel),
    saldoSac: F.saldoNoMes(res.sac, mes),
    saldoPrice: F.saldoNoMes(res.price, mes),
  });
  R.mes = (mes) => { const e = R.estado(mes); cena.atualizar({ entrada: fE, sac: e.sac, price: e.price }); return e; };
  const ev = (tipo, x, y) => glc.dispatchEvent(new PointerEvent(tipo, { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }));
  R.mover = (x, y) => ev('pointermove', x, y);
  R.apertar = (x, y) => ev('pointerdown', x, y);
  R.soltar = () => window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }));

  // ---------- desenho ----------
  const C = { noite: '#070b18', texto: '#e8ecf8', texto2: '#a6b1ce', texto3: '#74809f', luz: '#ffb547', luzS: '#ffd796', sac: '#2ea3e6', price: '#f2734e', linha: 'rgba(150,172,255,0.16)', apagada: '#1c2747' };
  const FD = 'Unbounded', FT = '"Instrument Sans"', FM = '"IBM Plex Mono"';
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const rr = (x, X, Y, w, h, r) => { x.beginPath(); x.roundRect(X, Y, w, h, r); };

  function fundo(x, W, H) {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c1534'); g.addColorStop(1, '#060a16'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (const [cx, cy, raio, cor] of [[0.85, 0.05, 0.75, '70,90,220,0.34'], [0.5, 1.05, 0.7, '255,181,71,0.10']]) {
      const r = x.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, W * raio);
      r.addColorStop(0, `rgba(${cor})`); r.addColorStop(1, `rgba(${cor.split(',').slice(0, 3).join(',')},0)`);
      x.fillStyle = r; x.fillRect(0, 0, W, H);
    }
    x.fillStyle = 'rgba(255,255,255,0.045)';
    for (let i = 24; i < W; i += 36) for (let j = 24; j < H; j += 36) { x.beginPath(); x.arc(i, j, 1.4, 0, 7); x.fill(); }
  }
  function logo(x, X, Y, s = 1) {
    x.save(); x.translate(X, Y); x.scale(s, s); x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = C.luz; x.lineWidth = 4; x.beginPath(); x.moveTo(2, 20); x.lineTo(22, 3); x.lineTo(42, 20); x.stroke();
    x.strokeStyle = C.texto; x.lineWidth = 3.4; rr(x, 10, 20, 24, 19, 3); x.stroke();
    x.fillStyle = C.luz; rr(x, 18, 26, 8, 7, 1.5); x.fill();
    x.fillStyle = C.texto; x.font = `700 34px ${FD}`; x.fillText('teto', 56, 36);
    x.restore();
  }
  const posRotulo = (el) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform || ''); return m ? [Number(m[1]), Number(m[2])] : null; };
  function pilula(x, cx, by, nome, valor, cor, s = 1) {
    x.save();
    const f1 = `700 ${22 * s}px ${FD}`, f2 = `600 ${22 * s}px ${FM}`;
    x.font = f1; const w1 = x.measureText(nome).width; x.font = f2; const w2 = x.measureText(valor).width;
    const pad = 16 * s, gap = 12 * s, h = 44 * s, w = pad * 2 + w1 + gap + w2, X = cx - w / 2, Y = by - h;
    x.fillStyle = 'rgba(7,11,24,0.82)'; rr(x, X, Y, w, h, h / 2); x.fill();
    x.strokeStyle = 'rgba(150,172,255,0.35)'; x.lineWidth = 1.5 * s; x.stroke();
    x.save(); x.clip(); x.fillStyle = cor; x.fillRect(X, Y, 5 * s, h); x.restore();
    x.fillStyle = C.texto; x.font = f1; x.fillText(nome, X + pad, Y + h * 0.67);
    x.fillStyle = C.luzS; x.font = f2; x.fillText(valor, X + pad + w1 + gap, Y + h * 0.67);
    x.restore();
  }
  function cursor(x, cx, cy, clique) {
    if (clique > 0) { x.save(); x.globalAlpha = 1 - clique; x.strokeStyle = C.luz; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 14 + clique * 46, 0, 7); x.stroke(); x.restore(); }
    x.save(); x.translate(cx, cy); x.scale(1.5, 1.5);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 24); x.lineTo(6.5, 18); x.lineTo(11, 28); x.lineTo(15, 26); x.lineTo(10.5, 16.5); x.lineTo(19, 16.5); x.closePath();
    x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 8; x.shadowOffsetY = 3; x.fillStyle = '#fff'; x.fill(); x.shadowColor = 'transparent';
    x.lineWidth = 1.6; x.strokeStyle = '#0b1020'; x.stroke(); x.restore();
  }
  const HUD = { x: 40, y: 1104, w: 1000, h: 206, play: [112, 1166], x0: 168, x1: 1000, y: 1104, trilhoY: 1218 };
  const thumbX = (mes) => HUD.x0 + (HUD.x1 - HUD.x0) * (mes / 360);

  R.desenhar = (cv, o) => {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    fundo(x, W, H);
    x.drawImage(glc, 0, SY, 1080, ALT);
    for (const [el, nome, cor, f] of [[rotS, 'SAC', C.sac, o.e.sac], [rotP, 'Price', C.price, o.e.price]]) {
      const p = posRotulo(el); if (p) pilula(x, p[0], Math.max(p[1] + SY, 314), nome, pct.format(f), cor);
    }
    x.save(); x.globalAlpha = o.tituloA;
    logo(x, 60, 52);
    x.font = `600 19px ${FM}`; x.fillStyle = C.luz; x.textAlign = 'right'; x.letterSpacing = '3px';
    x.fillText('PROJETO 4 · SIMULADOR 3D', W - 60, 84); x.letterSpacing = '0px'; x.textAlign = 'left';
    x.font = `700 60px ${FD}`; x.fillStyle = C.texto; x.fillText('Quanto do seu imóvel', 58, 186);
    x.shadowColor = 'rgba(255,181,71,0.55)'; x.shadowBlur = 34; x.fillStyle = C.luz; x.fillText('já é seu?', 58, 258);
    x.restore();
    if (o.legenda && o.legendaA > 0) {
      x.save(); x.globalAlpha = o.legendaA; x.font = `600 27px ${FT}`;
      const tw = x.measureText(o.legenda).width, bx = (W - tw) / 2 - 26, by = 1030;
      x.fillStyle = 'rgba(7,11,24,0.78)'; rr(x, bx, by, tw + 52, 54, 27); x.fill();
      x.strokeStyle = 'rgba(255,181,71,0.45)'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = C.texto; x.fillText(o.legenda, bx + 26, by + 36); x.restore();
    }
    // painel da linha do tempo
    x.save(); x.globalAlpha = o.hudA;
    x.fillStyle = 'rgba(14,22,46,0.92)'; rr(x, HUD.x, HUD.y, HUD.w, HUD.h, 28); x.fill(); x.strokeStyle = C.linha; x.lineWidth = 2; x.stroke();
    const [px, py] = HUD.play;
    x.save(); x.shadowColor = 'rgba(255,181,71,0.7)'; x.shadowBlur = 24; x.fillStyle = C.luz; x.beginPath(); x.arc(px, py, 34, 0, 7); x.fill(); x.restore();
    x.fillStyle = '#1a1205';
    if (o.tocando) { x.fillRect(px - 11, py - 13, 8, 26); x.fillRect(px + 3, py - 13, 8, 26); }
    else { x.beginPath(); x.moveTo(px - 9, py - 15); x.lineTo(px + 15, py); x.lineTo(px - 9, py + 15); x.closePath(); x.fill(); }
    x.font = `600 30px ${FM}`; x.fillStyle = C.texto;
    x.fillText(o.e.mes === 0 ? 'Assinatura do contrato' : `Mês ${o.e.mes} · ano ${Math.ceil(o.e.mes / 12)}`, 168, 1177);
    x.font = `500 20px ${FM}`; x.fillStyle = C.texto3; x.textAlign = 'right'; x.fillText('linha do tempo', 1000, 1174); x.textAlign = 'left';
    const tx = thumbX(o.e.mes);
    x.fillStyle = C.apagada; rr(x, HUD.x0, HUD.trilhoY - 4, HUD.x1 - HUD.x0, 8, 4); x.fill();
    x.fillStyle = C.luz; rr(x, HUD.x0, HUD.trilhoY - 4, Math.max(8, tx - HUD.x0), 8, 4); x.fill();
    x.save(); x.shadowColor = 'rgba(255,181,71,0.8)'; x.shadowBlur = 18; x.fillStyle = C.luzS; x.beginPath(); x.arc(tx, HUD.trilhoY, 14, 0, 7); x.fill(); x.restore();
    x.strokeStyle = C.noite; x.lineWidth = 4; x.beginPath(); x.arc(tx, HUD.trilhoY, 14, 0, 7); x.stroke();
    for (const [i, nome, cor, f, saldo] of [[0, 'SAC', C.sac, o.e.sac, o.e.saldoSac], [1, 'Price', C.price, o.e.price, o.e.saldoPrice]]) {
      const X = 72 + i * 488, Y = 1252;
      x.fillStyle = 'rgba(5,9,22,0.55)'; rr(x, X, Y, 456, 44, 12); x.fill();
      x.fillStyle = cor; x.beginPath(); x.arc(X + 22, Y + 22, 7, 0, 7); x.fill();
      x.font = `700 20px ${FD}`; x.fillStyle = C.texto; x.fillText(nome, X + 40, Y + 30);
      x.font = `600 24px ${FM}`; x.fillStyle = C.luzS; x.fillText(`${pct.format(f)} seu`, X + 130, Y + 31);
      x.font = `500 19px ${FM}`; x.fillStyle = C.texto2; x.textAlign = 'right'; x.fillText(`faltam ${brl0.format(saldo)}`, X + 440, Y + 30); x.textAlign = 'left';
    }
    x.restore();
    if (o.cursor) cursor(x, o.cursor.x, o.cursor.y, o.cursor.clique || 0);
    if (o.fimA > 0) telaFinal(x, W, H, o.fimA);
  };

  function telaFinal(x, W, H, a) {
    x.save();
    x.globalAlpha = a * 0.97; x.fillStyle = C.noite; x.fillRect(0, 0, W, H); x.globalAlpha = a;
    const r = x.createRadialGradient(W / 2, 560, 0, W / 2, 560, 600); r.addColorStop(0, 'rgba(255,181,71,0.16)'); r.addColorStop(1, 'rgba(255,181,71,0)');
    x.fillStyle = r; x.fillRect(0, 0, W, H);
    logo(x, W / 2 - 92, 210, 1.3);
    x.textAlign = 'center';
    x.font = `600 20px ${FM}`; x.fillStyle = C.luz; x.letterSpacing = '3px'; x.fillText('COM OS VALORES DE EXEMPLO', W / 2, 400); x.letterSpacing = '0px';
    x.font = `700 54px ${FD}`; x.fillStyle = C.texto; x.fillText('No SAC, você paga', W / 2, 490);
    x.save(); x.shadowColor = 'rgba(255,181,71,0.6)'; x.shadowBlur = 40; x.font = `700 84px ${FD}`; x.fillStyle = C.luz;
    x.fillText(`R$ ${Math.round(res.economiaJurosSac / 1000)} mil a menos`, W / 2, 598); x.restore();
    x.font = `700 54px ${FD}`; x.fillStyle = C.texto; x.fillText('de juros que na Price.', W / 2, 682);
    x.font = `400 27px ${FT}`; x.fillStyle = C.texto2; x.fillText('Imóvel de R$ 400 mil · 20% de entrada · 30 anos · 11,5% ao ano', W / 2, 752);
    x.font = `700 30px ${FT}`; const bt = `Simule o seu: ${SITE}`; const bw = x.measureText(bt).width + 70;
    x.save(); x.shadowColor = 'rgba(255,181,71,0.6)'; x.shadowBlur = 30; x.fillStyle = C.luz; rr(x, W / 2 - bw / 2, 830, bw, 76, 38); x.fill(); x.restore();
    x.fillStyle = '#1a1205'; x.fillText(bt, W / 2, 879);
    const chips = ['JavaScript', 'Three.js', '13 testes', 'GitHub Actions'];
    x.font = `600 24px ${FM}`;
    const ws = chips.map((c) => x.measureText(c).width + 40);
    let cx0 = W / 2 - (ws.reduce((s, v) => s + v, 0) + 14 * (chips.length - 1)) / 2; x.textAlign = 'left';
    chips.forEach((c, i) => {
      x.fillStyle = 'rgba(255,255,255,0.07)'; rr(x, cx0, 960, ws[i], 50, 25); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.2)'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = C.texto; x.fillText(c, cx0 + 20, 993); cx0 += ws[i] + 14;
    });
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(80, 1170, W - 160, 2);
    x.font = `700 30px ${FT}`; x.fillStyle = C.texto; x.fillText('Matheus Galvão', 80, 1232);
    const nw = x.measureText('Matheus Galvão').width;
    x.font = `400 26px ${FT}`; x.fillStyle = C.texto2; x.fillText('  ·  Desenvolvedor Full Stack', 80 + nw, 1232);
    x.textAlign = 'right'; x.font = `600 24px ${FM}`; x.fillStyle = C.luz; x.fillText('github.com/Matheus0811', W - 80, 1232);
    x.restore();
  }

  // Imagem estática (og.png 1200x630 e miniatura do portfólio)
  R.estatica = (W, H, mes = 120) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    R.mover(540, 450); R.mes(mes); for (let i = 0; i < 60; i++) R.passo(1000 / 30);
    const e = R.estado(mes);
    fundo(x, W, H);
    const sh = H * 1.14, sw = sh * (1080 / ALT), sx = W - sw + 10, sy = -0.015 * H, k = sw / 1080, s = H / 630;
    x.drawImage(glc, sx, sy, sw, sh);
    for (const [el, nome, cor, f] of [[rotS, 'SAC', C.sac, e.sac], [rotP, 'Price', C.price, e.price]]) {
      const p = posRotulo(el); if (p) pilula(x, sx + p[0] * k, Math.max(sy + p[1] * k, 56 * s), nome, pct.format(f), cor, Math.max(0.8, k));
    }
    logo(x, 60 * s, 56 * s, s);
    x.font = `700 ${56 * s}px ${FD}`; x.fillStyle = C.texto; x.fillText('Quanto do seu', 58 * s, 226 * s); x.fillText('imóvel', 58 * s, 296 * s);
    x.save(); x.shadowColor = 'rgba(255,181,71,0.55)'; x.shadowBlur = 30 * s; x.fillStyle = C.luz; x.fillText('já é seu?', 58 * s, 366 * s); x.restore();
    x.font = `400 ${25 * s}px ${FT}`; x.fillStyle = C.texto2;
    ['Simulador SAC x Price em 3D:', 'as janelas acendem conforme', 'o imóvel é quitado.'].forEach((l, i) => x.fillText(l, 60 * s, (430 + 34 * i) * s));
    x.font = `600 ${21 * s}px ${FM}`; x.fillStyle = C.luz; x.fillText(SITE, 60 * s, 574 * s);
    return cv;
  };

  // ---------- roteiro: tempos de cada cena (em segundos), ajustáveis para casar com uma narração ----------
  R.tempos = { play: 1.5, quitado: 9.6, arrasto: 10.6, giro: 13.6, fim: 17.2, total: 21.5 };
  R.roteiro = (t) => {
    const T = R.tempos;
    const o = { tituloA: clamp(t / 0.8), hudA: clamp((t - 0.2) / 0.6), tocando: false, legenda: null, legendaA: 0, cursor: null, fimA: 0, mes: 0, arrasto: null };
    const fade = (a, b) => clamp(Math.min((t - a) / 0.35, (b - t) / 0.35));
    const [px, py] = HUD.play;
    const meio = (T.play + T.quitado) / 2;
    if (t < T.play) {
      const k = ease(clamp((t - Math.max(0.3, T.play - 1.2)) / 1.1));
      o.cursor = { x: lerp(860, px + 6, k), y: lerp(1000, py + 4, k) };
    } else if (t < T.quitado) {
      o.tocando = t < T.quitado - 0.1;
      o.mes = Math.round(360 * ease(clamp((t - T.play - 0.1) / (T.quitado - T.play - 0.3))));
      const c = clamp((t - T.play) / 0.45);
      o.cursor = { x: lerp(px + 6, px + 40, clamp((t - T.play - 0.7) / 1)), y: lerp(py + 4, py + 60, clamp((t - T.play - 0.7) / 1)), clique: c < 1 ? c : 0 };
      if (t < meio) { o.legenda = 'Cada janela acesa é um pedaço do imóvel já pago'; o.legendaA = fade(T.play + 0.3, meio); }
      else { o.legenda = 'No SAC, a dívida cai mais rápido no começo'; o.legendaA = fade(meio, T.quitado); }
    } else if (t < T.giro) {
      const ax = thumbX(360), bx = thumbX(120);
      if (t < T.arrasto) {
        o.mes = 360;
        const k = ease(clamp((t - T.quitado) / Math.min(0.9, T.arrasto - T.quitado)));
        o.cursor = { x: lerp(px + 40, ax, k), y: lerp(py + 60, HUD.trilhoY, k) };
        o.legenda = 'Quitado: o imóvel é 100% seu'; o.legendaA = fade(T.quitado, T.arrasto + 0.3);
      } else {
        const k = ease(clamp((t - T.arrasto - 0.2) / Math.max(0.6, T.giro - T.arrasto - 1.2)));
        const xx = lerp(ax, bx, k);
        o.mes = Math.round(360 * (xx - HUD.x0) / (HUD.x1 - HUD.x0));
        o.cursor = { x: xx, y: HUD.trilhoY };
        o.legenda = 'Arraste para qualquer mês do contrato'; o.legendaA = fade(T.arrasto + 0.3, T.giro);
      }
    } else if (t < T.fim) {
      o.mes = 120;
      const xs = thumbX(120);
      if (t < T.giro + 0.8) {
        const k = ease(clamp((t - T.giro) / 0.8));
        o.cursor = { x: lerp(xs, 760, k), y: lerp(HUD.trilhoY, 720, k) };
      } else {
        const k = clamp((t - T.giro - 0.9) / Math.max(0.8, T.fim - T.giro - 1.1));
        o.cursor = { x: 760 - 420 * Math.sin(k * Math.PI), y: 720 + 30 * Math.sin(k * Math.PI * 2) };
        o.arrasto = { x: o.cursor.x, y: o.cursor.y, ativo: t < T.fim - 0.2 };
      }
      o.legenda = 'Gire o prédio com o mouse'; o.legendaA = fade(T.giro + 0.1, T.fim);
    } else {
      o.mes = 120;
      o.fimA = ease(clamp((t - T.fim) / 0.7));
    }
    return o;
  };

  function quadro(cv, t, fps, estado) {
    const o = R.roteiro(t);
    if (o.arrasto) {
      const gx = o.arrasto.x, gy = o.arrasto.y - SY;
      if (o.arrasto.ativo && !estado.arrastando) { R.apertar(gx, gy); estado.arrastando = true; }
      if (estado.arrastando) R.mover(gx, gy);
      if (!o.arrasto.ativo && estado.arrastando) { R.soltar(); estado.arrastando = false; }
    }
    o.e = R.mes(o.mes);
    R.passo(1000 / fps);
    R.desenhar(cv, o);
  }
  function reiniciar(fps) { R.mover(540, 450); R.mes(0); for (let i = 0; i < 40; i++) R.passo(1000 / fps); }

  // Um quadro solto, para conferir (desenha tudo desde o começo até t)
  R.teste = (t, fps = 30) => {
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
    reiniciar(fps); const est = { arrastando: false };
    for (let i = 0; i <= Math.round(t * fps); i++) quadro(cv, i / fps, fps, est);
    if (est.arrastando) R.soltar();
    return cv;
  };

  // ---------- gravação (MP4 H.264, com áudio opcional) ----------
  R.gravar = async ({ fps = 30, audio = null, audioIni = 0.3 } = {}) => {
    const W = 1080, H = 1350;
    const M = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm');
    let codec = null;
    for (const c of ['avc1.640028', 'avc1.4d0028']) {
      if ((await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 8e6, framerate: fps })).supported) { codec = c; break; }
    }
    if (!codec) throw new Error('Este navegador não codifica H.264');

    let pcm = null, aud = null;
    if (audio) {
      const ctx = new OfflineAudioContext(1, 1, 48000);
      const buf = await ctx.decodeAudioData(audio.slice(0));
      pcm = buf.getChannelData(0);
      for (const c of [{ codec: 'mp4a.40.2', mux: 'aac' }, { codec: 'opus', mux: 'opus' }]) {
        const cfg = { codec: c.codec, sampleRate: 48000, numberOfChannels: 1, bitrate: 128000 };
        if ((await AudioEncoder.isConfigSupported(cfg)).supported) { aud = { ...c, cfg }; break; }
      }
      if (!aud) throw new Error('Este navegador não codifica áudio AAC nem Opus');
      R.tempos.total = Math.max(R.tempos.total, audioIni + pcm.length / 48000 + 1.2);
    }

    const alvo = new M.ArrayBufferTarget();
    const muxer = new M.Muxer({
      target: alvo, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
      video: { codec: 'avc', width: W, height: H, frameRate: fps },
      ...(aud ? { audio: { codec: aud.mux, numberOfChannels: 1, sampleRate: 48000 } } : {}),
    });
    let erro = null;
    const venc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { erro = e; } });
    venc.configure({ codec, width: W, height: H, bitrate: 8e6, framerate: fps, avc: { format: 'avc' } });

    if (aud) {
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: (e) => { erro = e; } });
      aenc.configure(aud.cfg);
      const total = Math.ceil(R.tempos.total * 48000);
      const tudo = new Float32Array(total);
      tudo.set(pcm.subarray(0, Math.max(0, total - Math.round(audioIni * 48000))), Math.round(audioIni * 48000));
      for (let i = 0; i < total; i += 1024) {
        const pedaco = tudo.subarray(i, Math.min(total, i + 1024));
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: pedaco.length, numberOfChannels: 1, timestamp: Math.round((i / 48000) * 1e6), data: pedaco });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush();
    }

    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const totalQ = Math.round(R.tempos.total * fps);
    reiniciar(fps); const est = { arrastando: false };
    for (let i = 0; i < totalQ; i++) {
      quadro(cv, i / fps, fps, est);
      const vf = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
      if (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
      if (erro) throw erro;
    }
    await venc.flush();
    muxer.finalize();
    R.video = new Blob([alvo.buffer], { type: 'video/mp4' });
    return { codec, audio: aud?.mux ?? 'sem áudio', segundos: R.tempos.total, bytes: R.video.size };
  };

  window.__rec = R;
  return R;
}
