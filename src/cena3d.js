// Cena 3D com Three.js: duas torres (SAC e Price) sobre uma base flutuante.
// Cada janela representa um pedaço do imóvel. As janelas acendem de baixo para cima:
// azul-claro = entrada, âmbar = parte do financiamento já amortizada, escuras = o que falta pagar.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const ANDARES = 22;
const JANELAS_POR_FACE = 4;
const ALTURA_ANDAR = 0.34;
const LARGURA = 1.9;
const POR_ANDAR = JANELAS_POR_FACE * 4;
const TOTAL_JANELAS = ANDARES * POR_ANDAR;

const COR_APAGADA = new THREE.Color('#18223f');
const COR_ENTRADA = new THREE.Color('#bfe9ff');
const COR_PAGA = new THREE.Color('#ffb547');

function criarTorre(x, corBorda) {
  const grupo = new THREE.Group();
  grupo.position.x = x;
  const altura = ANDARES * ALTURA_ANDAR;

  const corpo = new THREE.Mesh(
    new THREE.BoxGeometry(LARGURA, altura, LARGURA),
    new THREE.MeshStandardMaterial({ color: 0x111a34, metalness: 0.55, roughness: 0.35 }),
  );
  corpo.position.y = altura / 2 + 0.25;
  grupo.add(corpo);

  const bordas = new THREE.LineSegments(
    new THREE.EdgesGeometry(corpo.geometry),
    new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.75 }),
  );
  bordas.position.copy(corpo.position);
  grupo.add(bordas);

  // Lajes: linhas finas a cada 2 andares, dão leitura de "prédio".
  const lajeMat = new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.18 });
  for (let a = 2; a < ANDARES; a += 2) {
    const y = 0.25 + a * ALTURA_ANDAR;
    const h = LARGURA / 2 + 0.002;
    const pts = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([px, pz]) => new THREE.Vector3(px, y, pz));
    grupo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lajeMat));
  }

  // Topo: casa de máquinas + antena com luz.
  const topo = new THREE.Mesh(
    new THREE.BoxGeometry(LARGURA * 0.55, 0.35, LARGURA * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x0d1530, metalness: 0.5, roughness: 0.4 }),
  );
  topo.position.y = altura + 0.25 + 0.175;
  grupo.add(topo);
  const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), new THREE.MeshBasicMaterial({ color: 0x8090b8 }));
  antena.position.y = topo.position.y + 0.6;
  grupo.add(antena);
  const luzAntena = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: corBorda }));
  luzAntena.position.y = antena.position.y + 0.48;
  grupo.add(luzAntena);

  // Janelas: uma InstancedMesh com cor por janela.
  const janelas = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.28, 0.19),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    TOTAL_JANELAS,
  );
  const m = new THREE.Object3D();
  const passo = LARGURA / JANELAS_POR_FACE;
  let n = 0;
  for (let a = 0; a < ANDARES; a++) {
    const y = 0.25 + a * ALTURA_ANDAR + ALTURA_ANDAR / 2;
    for (let face = 0; face < 4; face++) {
      for (let c = 0; c < JANELAS_POR_FACE; c++) {
        const off = -LARGURA / 2 + passo * (c + 0.5);
        const d = LARGURA / 2 + 0.006;
        const ang = (face * Math.PI) / 2;
        // posição na face 0 (frente) girada em torno do eixo Y
        m.position.set(off * Math.cos(ang) + d * Math.sin(ang), y, d * Math.cos(ang) - off * Math.sin(ang));
        m.rotation.set(0, ang, 0);
        m.updateMatrix();
        janelas.setMatrixAt(n, m.matrix);
        janelas.setColorAt(n, COR_APAGADA);
        n++;
      }
    }
  }
  janelas.instanceMatrix.needsUpdate = true;
  grupo.add(janelas);

  // Luz que "sobe" junto com as janelas acesas.
  const brilho = new THREE.PointLight(0xffb547, 0, 6, 2);
  brilho.position.set(0, 1, LARGURA);
  grupo.add(brilho);

  const atual = Array.from({ length: TOTAL_JANELAS }, () => COR_APAGADA.clone());
  const alvo = Array.from({ length: TOTAL_JANELAS }, () => COR_APAGADA.clone());

  return {
    grupo,
    luzAntena,
    alturaTopo: luzAntena.position.y,
    definir(fracEntrada, fracTotal) {
      const nEntrada = Math.round(fracEntrada * TOTAL_JANELAS);
      const nTotal = Math.round(fracTotal * TOTAL_JANELAS);
      for (let k = 0; k < TOTAL_JANELAS; k++) {
        alvo[k].copy(k < nEntrada ? COR_ENTRADA : k < nTotal ? COR_PAGA : COR_APAGADA);
      }
      const andarTopo = Math.min(ANDARES, nTotal / POR_ANDAR);
      brilho.position.y = 0.25 + andarTopo * ALTURA_ANDAR;
      brilho.intensity = fracTotal > fracEntrada ? 2.2 : 0.6;
    },
    animar(velocidade) {
      let mudou = false;
      for (let k = 0; k < TOTAL_JANELAS; k++) {
        const a = atual[k];
        const b = alvo[k];
        if (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 0.004) {
          a.lerp(b, velocidade);
          janelas.setColorAt(k, a);
          mudou = true;
        }
      }
      if (mudou) janelas.instanceColor.needsUpdate = true;
    },
  };
}

function criarCidadeAoFundo(cena) {
  // Prédios escuros em volta, só silhueta; a neblina apaga os mais distantes.
  const mat = new THREE.MeshStandardMaterial({ color: 0x0c1329, metalness: 0.3, roughness: 0.8 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const pontos = [];
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 46; k++) {
    const ang = aleatorio() * Math.PI * 2;
    const raio = 9 + aleatorio() * 9;
    const x = Math.cos(ang) * raio;
    const z = Math.sin(ang) * raio - 4;
    if (z > 2) continue; // nada entre a câmera e as torres
    const h = 1.5 + aleatorio() * 6;
    const larg = 0.8 + aleatorio() * 1.4;
    const p = new THREE.Mesh(geo, mat);
    p.scale.set(larg, h, larg);
    p.position.set(x, h / 2 - 0.6, z);
    cena.add(p);
    // algumas janelas acesas soltas
    for (let j = 0; j < 4; j++) {
      if (aleatorio() < 0.45) pontos.push(x + (aleatorio() - 0.5) * larg, aleatorio() * h - 0.5, z + larg / 2 + 0.01);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pontos, 3));
  cena.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc66e, size: 0.09, transparent: true, opacity: 0.7 })));
}

function criarPoeiraDeLuz() {
  const n = 220;
  const pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    pos[k * 3] = (Math.random() - 0.5) * 16;
    pos[k * 3 + 1] = Math.random() * 10;
    pos[k * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pontos = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.035, transparent: true, opacity: 0.55 }));
  return pontos;
}

/**
 * Monta a cena dentro de `container`.
 * rotulos: { sac: HTMLElement, price: HTMLElement } posicionados sobre o topo de cada torre.
 */
export function criarCena(container, { rotulos, reduzirMovimento = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);

  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog(0x070b18, 13, 30);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const alvoCamera = new THREE.Vector3(0, 3.7, 0);

  cena.add(new THREE.HemisphereLight(0x8fb4ff, 0x05070f, 0.7));
  const sol = new THREE.DirectionalLight(0xc8d6ff, 0.9);
  sol.position.set(6, 12, 8);
  cena.add(sol);
  const contraLuz = new THREE.DirectionalLight(0x6a5cff, 0.6);
  contraLuz.position.set(-8, 4, -6);
  cena.add(contraLuz);

  const mundo = new THREE.Group();
  cena.add(mundo);

  // Base flutuante com anel de luz e grade polar.
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 5.2, 0.5, 64),
    new THREE.MeshStandardMaterial({ color: 0x0e1630, metalness: 0.6, roughness: 0.4 }),
  );
  mundo.add(base);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.035, 8, 128), new THREE.MeshBasicMaterial({ color: 0x2ea3e6 }));
  anel.rotation.x = Math.PI / 2;
  anel.position.y = 0.25;
  mundo.add(anel);
  const grade = new THREE.PolarGridHelper(5.4, 12, 6, 64, 0x233366, 0x1a274d);
  grade.position.y = 0.26;
  mundo.add(grade);

  const torreSac = criarTorre(-1.75, 0x2ea3e6);
  const torrePrice = criarTorre(1.75, 0xf2734e);
  mundo.add(torreSac.grupo, torrePrice.grupo);

  criarCidadeAoFundo(cena);
  const poeira = criarPoeiraDeLuz();
  cena.add(poeira);

  // Interação: o mouse inclina a cena; arrastar gira.
  let giroAlvo = -0.35;
  let giro = giroAlvo;
  let inclinacaoAlvo = 0;
  let arrastando = null;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    if (arrastando) {
      giroAlvo = arrastando.giro + (e.clientX - arrastando.x) * 0.008;
    } else {
      inclinacaoAlvo = ny * 0.12;
      giroAlvo = -0.35 + nx * 0.5;
    }
  });
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { arrastando = { x: e.clientX, giro: giroAlvo }; el.style.cursor = 'grabbing'; }
  });
  const soltar = () => { arrastando = null; el.style.cursor = 'grab'; };
  window.addEventListener('pointerup', soltar);
  el.style.cursor = 'grab';

  // Tamanho e enquadramento (em tela estreita a câmera recua).
  function ajustar() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const recuo = camera.aspect < 1.2 ? (1.2 - camera.aspect) * 13 : 0;
    camera.position.set(0, 6.6 + recuo * 0.25, 18.5 + recuo);
    camera.lookAt(alvoCamera);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(container);
  ajustar();

  // Só desenha quando a cena está visível.
  let visivel = true;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(container);

  const v = new THREE.Vector3();
  function posicionarRotulo(torre, rotulo) {
    if (!rotulo) return;
    v.set(0, torre.alturaTopo + 0.45, 0);
    torre.grupo.localToWorld(v);
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * container.clientWidth;
    // nunca acima da legenda do topo da cena
    const y = Math.max(88, (-v.y * 0.5 + 0.5) * container.clientHeight);
    rotulo.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  const relogio = new THREE.Clock();
  function quadro() {
    requestAnimationFrame(quadro);
    if (!visivel) return;
    const t = relogio.getElapsedTime();
    const balanco = reduzirMovimento ? 0 : Math.sin(t * 0.25) * 0.12;
    giro += (giroAlvo + balanco - giro) * 0.05;
    mundo.rotation.y = giro;
    mundo.rotation.x += (inclinacaoAlvo - mundo.rotation.x) * 0.05;
    if (!reduzirMovimento) {
      mundo.position.y = Math.sin(t * 0.8) * 0.08;
      poeira.rotation.y = t * 0.02;
      const pisca = 0.5 + 0.5 * Math.sin(t * 3);
      torreSac.luzAntena.scale.setScalar(0.7 + pisca * 0.5);
      torrePrice.luzAntena.scale.setScalar(0.7 + (1 - pisca) * 0.5);
    }
    const vel = reduzirMovimento ? 1 : 0.12;
    torreSac.animar(vel);
    torrePrice.animar(vel);
    renderer.render(cena, camera);
    posicionarRotulo(torreSac, rotulos?.sac);
    posicionarRotulo(torrePrice, rotulos?.price);
  }
  quadro();

  return {
    /** Frações de 0 a 1: quanto do imóvel é entrada e quanto já é seu em cada sistema. */
    atualizar({ entrada, sac, price }) {
      torreSac.definir(entrada, sac);
      torrePrice.definir(entrada, price);
    },
  };
}
