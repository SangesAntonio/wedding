import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Maximize, Minus, Plus } from "lucide-react";
import { POSTI, SETTORI, TAVOLI, liberiAlTavolo, type Occupati, type Posto, type SettoreId } from "../data/sala";
import { SPOSI } from "../config";

// La scena è pensata per il vecchio modello di luce di three.js (prima della r155):
// disattiviamo la gestione colore e moltiplichiamo le intensità per π per ottenere la stessa resa.
THREE.ColorManagement.enabled = false;
const PI = Math.PI;

const COL_SPOSI = 0xb7994f;
const COL_SCELTA = 0x8b8b85;
const COL_OCCUPATA = 0xffffff;
const COL_ALONE = 0x45453f;

export interface AzioniSala {
  zoom: (f: number) => void;
  reset: () => void;
  vaiA: (z: number, r: number) => void;
  vaiATavolo: (x: number, z: number) => void;
}

interface Props {
  occupati: Occupati;
  selezione: Posto[];
  onToggle: (id: string) => void;
  onAvviso: (msg: string) => void;
  azioni?: MutableRefObject<AzioniSala | null>;
}

interface Sedia {
  g: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  alone: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  fiamma: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  base: number;
  sposo: boolean;
  occ: boolean;
  sel: boolean;
  hover: boolean;
}

function testoSuTela(canvas: HTMLCanvasElement, testo: string, colore: string) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "500 54px 'Cormorant Garamond', Georgia, serif";
  ctx.fillStyle = colore;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(testo, 256, 70);
}

function etichetta(testo: string, colore: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  testoSuTela(canvas, testo, colore);
  const tex = new THREE.CanvasTexture(canvas);
  return { sprite: new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })), canvas, tex };
}

function texturePavimento() {
  const n = document.createElement("canvas");
  n.width = n.height = 1024;
  const e = n.getContext("2d")!;
  e.fillStyle = "#F4EFE1";
  e.fillRect(0, 0, 1024, 1024);
  e.strokeStyle = "rgba(143,165,140,.28)";
  for (let t = 1; t <= 9; t++) {
    e.lineWidth = t % 3 === 0 ? 2.5 : 1;
    e.beginPath();
    e.arc(512, 512, t * 52, 0, PI * 2);
    e.stroke();
  }
  e.strokeStyle = "rgba(183,153,79,.30)";
  e.lineWidth = 1.6;
  for (let t = 0; t < 24; t++) {
    const a = ((PI * 2) / 24) * t;
    e.beginPath();
    e.moveTo(512 + Math.cos(a) * 160, 512 + Math.sin(a) * 160);
    e.quadraticCurveTo(512 + Math.cos(a + 0.18) * 330, 512 + Math.sin(a + 0.18) * 330, 512 + Math.cos(a) * 490, 512 + Math.sin(a) * 490);
    e.stroke();
  }
  return new THREE.CanvasTexture(n);
}

const ZONE: { k: SettoreId; z: number; r: number }[] = [
  { k: "palco", z: -8, r: 13 },
  { k: "vicino", z: -3.4, r: 16 },
  { k: "centro", z: 2.5, r: 18 },
  { k: "fondo", z: 8.9, r: 16 },
];

export default function Sala3D({ occupati, selezione, onToggle, onAvviso, azioni }: Props) {
  const tela = useRef<HTMLDivElement>(null);
  const sedieRef = useRef<Map<string, Sedia>>(new Map());
  const etichetteRef = useRef<Map<string, { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }>>(new Map());
  const occRef = useRef(occupati);
  const azioniLocali = useRef<AzioniSala | null>(null);
  const cb = useRef({ onToggle, onAvviso });
  occRef.current = occupati;
  useEffect(() => {
    cb.current = { onToggle, onAvviso };
  });

  // Costruzione della scena: una volta sola.
  useEffect(() => {
    const host = tela.current;
    if (!host) return;
    const scena = new THREE.Scene();
    scena.fog = new THREE.Fog(0xf2ecdd, 36, 86);
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
    const cur = { r: 31, theta: 0, phi: 0.93, tx: 0, tz: -0.4 };
    const obj = { ...cur };
    const lim = { rMin: 8, rMax: 40, phiMin: 0.2, phiMax: 1.3, pan: 11 };
    const mira = new THREE.Vector3();
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const limita = () => {
      obj.r = clamp(obj.r, lim.rMin, lim.rMax);
      obj.phi = clamp(obj.phi, lim.phiMin, lim.phiMax);
      const d = Math.hypot(obj.tx, obj.tz);
      if (d > lim.pan) {
        obj.tx *= lim.pan / d;
        obj.tz *= lim.pan / d;
      }
    };
    const posizionaCamera = () => {
      mira.set(cur.tx, 0.6, cur.tz);
      cam.position.set(
        cur.tx + cur.r * Math.sin(cur.phi) * Math.sin(cur.theta),
        0.6 + cur.r * Math.cos(cur.phi),
        cur.tz + cur.r * Math.sin(cur.phi) * Math.cos(cur.theta),
      );
      cam.lookAt(mira);
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", touchAction: "none", cursor: "grab", width: "100%", height: "100%" });

    scena.add(new THREE.HemisphereLight(0xfffaf0, 0xd8d6c4, 0.95 * PI));
    const sole = new THREE.DirectionalLight(0xfff4dc, 0.8 * PI);
    sole.position.set(9, 18, 8);
    sole.castShadow = true;
    sole.shadow.mapSize.set(1024, 1024);
    Object.assign(sole.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, far: 50 });
    scena.add(sole);
    const calda = new THREE.PointLight(0xffd9a0, 0.5 * PI, 32, 1);
    calda.position.set(0, 6, -5);
    scena.add(calda);

    // pavimento, bordo, pista
    const pav = new THREE.Mesh(new THREE.CircleGeometry(15.5, 72), new THREE.MeshStandardMaterial({ map: texturePavimento(), roughness: 0.92 }));
    pav.rotation.x = -PI / 2;
    pav.receiveShadow = true;
    scena.add(pav);
    const bordo = new THREE.Mesh(new THREE.RingGeometry(15.4, 16.1, 72), new THREE.MeshBasicMaterial({ color: 0xcfc5a9, side: THREE.DoubleSide }));
    bordo.rotation.x = -PI / 2;
    bordo.position.y = 0.012;
    scena.add(bordo);
    const pista = new THREE.Mesh(new THREE.CircleGeometry(2.7, 56), new THREE.MeshStandardMaterial({ color: 0xeae3cf, roughness: 0.45, metalness: 0.08 }));
    pista.rotation.x = -PI / 2;
    pista.position.set(0, 0.02, 4.7);
    scena.add(pista);

    // arco floreale
    const arco = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.1, 10, 44, PI), new THREE.MeshStandardMaterial({ color: 0xb7994f, roughness: 0.5, metalness: 0.35 }));
    arco.position.set(0, 0, -10.6);
    arco.castShadow = true;
    scena.add(arco);
    for (let t = 0; t < 34; t++) {
      const a = (PI / 34) * t + 0.05;
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(0.13 + (t % 4) * 0.05, 7, 6),
        new THREE.MeshStandardMaterial({ color: t % 3 === 0 ? 0xf3efe0 : 0x8fa37e, roughness: 0.85 }),
      );
      f.scale.set(1, 0.55, 1.5);
      f.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5, -10.6 + (t % 2 ? 0.16 : -0.16));
      scena.add(f);
    }
    [-2.6, 2.6].forEach((x) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0xcfc5a9, roughness: 0.7 }));
      c.position.set(x, 1.3, -10.6);
      c.castShadow = true;
      scena.add(c);
    });

    // aloni colorati sotto i tavoli
    TAVOLI.forEach((t) => {
      const s = SETTORI[t.set];
      const disco = new THREE.Mesh(new THREE.CircleGeometry(t.sposi ? 2.95 : 2.45, 48), new THREE.MeshBasicMaterial({ color: s.hex, transparent: true, opacity: 0.11 }));
      disco.rotation.x = -PI / 2;
      disco.position.set(t.x, 0.025, t.z);
      scena.add(disco);
      const anello = new THREE.Mesh(
        new THREE.RingGeometry(t.sposi ? 2.9 : 2.4, t.sposi ? 2.97 : 2.47, 48),
        new THREE.MeshBasicMaterial({ color: s.hex, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      anello.rotation.x = -PI / 2;
      anello.position.set(t.x, 0.03, t.z);
      scena.add(anello);
    });

    // tavoli
    const matPiano = new THREE.MeshStandardMaterial({ color: 0xfffdf5, roughness: 0.5 });
    const matGamba = new THREE.MeshStandardMaterial({ color: 0xe6e0cd, roughness: 0.9 });
    const etichette = etichetteRef.current;
    etichette.clear();
    TAVOLI.forEach((t) => {
      const s = SETTORI[t.set];
      const piano = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, 0.1, 44), matPiano);
      piano.position.set(t.x, 0.78, t.z);
      piano.castShadow = piano.receiveShadow = true;
      scena.add(piano);
      const tovaglia = new THREE.Mesh(
        new THREE.CylinderGeometry(t.r, t.r * 0.72, 0.72, 32, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xfbf7ea, roughness: 0.85, side: THREE.DoubleSide }),
      );
      tovaglia.position.set(t.x, 0.38, t.z);
      scena.add(tovaglia);
      const gamba = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 0.78, 12), matGamba);
      gamba.position.set(t.x, 0.39, t.z);
      scena.add(gamba);
      const filo = new THREE.Mesh(new THREE.TorusGeometry(t.r - 0.05, 0.032, 8, 44), new THREE.MeshStandardMaterial({ color: s.hex, roughness: 0.4, metalness: 0.25 }));
      filo.rotation.x = -PI / 2;
      filo.position.set(t.x, 0.845, t.z);
      scena.add(filo);
      const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 0.35, metalness: 0.4 }));
      vaso.position.set(t.x, 0.99, t.z);
      scena.add(vaso);
      for (let i = 0; i < 7; i++) {
        const a = ((PI * 2) / 7) * i;
        const foglia = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8fa37e : 0xf2eddd, roughness: 0.85 }));
        foglia.scale.set(1, 0.5, 1.6);
        foglia.position.set(t.x + Math.cos(a) * 0.22, 1.22 + (i % 3) * 0.07, t.z + Math.sin(a) * 0.22);
        foglia.rotation.y = a;
        scena.add(foglia);
      }
      if (t.sposi) {
        const anelli = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 28), new THREE.MeshStandardMaterial({ color: COL_SPOSI, roughness: 0.25, metalness: 0.6 }));
        anelli.rotation.x = -PI / 2;
        anelli.position.set(t.x, 1.5, t.z);
        scena.add(anelli);
      }
      const testo = t.sposi ? t.cod : `${t.cod} · ${liberiAlTavolo(t.cod, occRef.current)} liberi`;
      const e = etichetta(testo, t.sposi ? "#3E9AC4" : "#7C7A6C");
      e.sprite.position.set(t.x, 2.05, t.z);
      e.sprite.scale.set(t.sposi ? 2.1 : 3.4, t.sposi ? 0.52 : 0.85, 1);
      scena.add(e.sprite);
      if (!t.sposi) etichette.set(t.cod, e);
    });

    // cartelli dei settori
    const cartelli: [string, string, number][] = [
      [`${SETTORI.palco.tag.toUpperCase()} · ${SETTORI.palco.prezzo} €`, SETTORI.palco.col, -8],
      [`${SETTORI.vicino.tag.toUpperCase()} · ${SETTORI.vicino.prezzo} €`, SETTORI.vicino.col, -3.4],
      [`${SETTORI.centro.tag.toUpperCase()} · ${SETTORI.centro.prezzo} €`, SETTORI.centro.col, 1.6],
      [`${SETTORI.fondo.tag.toUpperCase()} · ${SETTORI.fondo.prezzo} €`, SETTORI.fondo.col, 8.9],
    ];
    cartelli.forEach(([txt, col, z]) => {
      const e = etichetta(txt, col);
      e.sprite.position.set(-10.4, 1.4, z);
      e.sprite.scale.set(5.6, 1.4, 1);
      scena.add(e.sprite);
    });

    // lanterne sospese
    const lanterne: { g: THREE.Group; base: number; sfasa: number; alone: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> }[] = [];
    for (let t = 0; t < 10; t++) {
      const a = ((PI * 2) / 10) * t + 0.3;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * 11.5, 4.2 + (t % 3) * 0.5, Math.sin(a) * 11.5 - 1);
      const filo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.4, 5), new THREE.MeshBasicMaterial({ color: 0xcfc5a9 }));
      filo.position.y = 1.9;
      g.add(filo);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffeab8 })));
      const alone = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.18 }));
      g.add(alone);
      scena.add(g);
      lanterne.push({ g, base: g.position.y, sfasa: t * 0.8, alone });
    }

    // lucciole
    const N = 90;
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * PI * 2;
      const r = 2 + Math.random() * 13;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = Math.sin(a) * r;
      vel[i] = 0.002 + Math.random() * 0.006;
    }
    const geoLucciole = new THREE.BufferGeometry();
    geoLucciole.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const lucciole = new THREE.Points(geoLucciole, new THREE.PointsMaterial({ color: 0xf0e0b0, size: 0.11, transparent: true, opacity: 0.8, depthWrite: false }));
    scena.add(lucciole);

    // sedie
    const geoSeduta = new THREE.CylinderGeometry(0.3, 0.26, 0.11, 18);
    const geoSchienale = new THREE.TorusGeometry(0.24, 0.035, 7, 18, PI);
    const geoMontante = new THREE.CylinderGeometry(0.032, 0.032, 0.55, 6);
    const geoGamba = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6);
    const matGambe = new THREE.MeshStandardMaterial({ color: 0xded7c2, roughness: 0.9 });
    const sedie = sedieRef.current;
    sedie.clear();
    const sedute: THREE.Mesh[] = [];
    POSTI.forEach((p) => {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = -p.ang + PI / 2;
      const occ = occRef.current.has(p.id);
      const base = p.sposo ? COL_SPOSI : SETTORI[p.set].hex;
      const mat = new THREE.MeshStandardMaterial({ color: p.sposo ? COL_SPOSI : occ ? COL_OCCUPATA : base, roughness: occ ? 0.9 : 0.62, metalness: occ ? 0 : 0.06 });
      const seduta = new THREE.Mesh(geoSeduta, mat);
      seduta.position.y = 0.44;
      seduta.castShadow = true;
      g.add(seduta);
      const schienale = new THREE.Mesh(geoSchienale, mat);
      schienale.position.set(0, 0.96, -0.24);
      g.add(schienale);
      [-0.22, 0.22].forEach((x) => {
        const m = new THREE.Mesh(geoMontante, mat);
        m.position.set(x, 0.7, -0.24);
        g.add(m);
      });
      [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]].forEach(([x, z]) => {
        const m = new THREE.Mesh(geoGamba, matGambe);
        m.position.set(x, 0.21, z);
        g.add(m);
      });
      const alone = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.58, 28), new THREE.MeshBasicMaterial({ color: COL_ALONE, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      alone.rotation.x = -PI / 2;
      alone.position.y = 0.04;
      g.add(alone);
      const fiamma = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe6ae, transparent: true, opacity: 0 }));
      fiamma.position.y = 1.5;
      g.add(fiamma);
      if (p.sposo) {
        const anello = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: COL_SPOSI, metalness: 0.6, roughness: 0.3 }));
        anello.position.set(0, 1.22, -0.24);
        g.add(anello);
      }
      scena.add(g);
      seduta.userData = { id: p.id };
      sedute.push(seduta);
      sedie.set(p.id, { g, mat, alone, fiamma, base, sposo: p.sposo, occ, sel: false, hover: false });
    });

    // interazione: un dito ruota, due dita zoom/spostamento, tocco = scelta
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const puntatori = new Map<number, { x: number; y: number }>();
    let t0 = 0;
    let percorso = 0;
    let distPrec = 0;
    let centroPrec: { x: number; y: number } | null = null;
    let sopra: string | null = null;
    const el = renderer.domElement;

    const colpito = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      ndc.x = ((x - r.left) / r.width) * 2 - 1;
      ndc.y = -((y - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, cam);
      return ray.intersectObjects(sedute, false)[0];
    };
    const sposta = (dx: number, dy: number) => {
      const k = cur.r * 0.0016;
      const c = Math.cos(obj.theta);
      const s = Math.sin(obj.theta);
      obj.tx -= (c * dx + s * dy) * k;
      obj.tz -= (-s * dx + c * dy) * k;
      limita();
    };
    const giu = (e: PointerEvent) => {
      puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (puntatori.size === 1) {
        t0 = performance.now();
        percorso = 0;
      }
      if (puntatori.size === 2) {
        distPrec = 0;
        centroPrec = null;
      }
      el.style.cursor = "grabbing";
      el.setPointerCapture?.(e.pointerId);
    };
    const muovi = (e: PointerEvent) => {
      const p = puntatori.get(e.pointerId);
      if (!p) {
        if (e.pointerType !== "mouse") return;
        const hit = colpito(e.clientX, e.clientY);
        const id = hit ? (hit.object.userData.id as string) : null;
        if (id !== sopra) {
          if (sopra) sedie.get(sopra)!.hover = false;
          if (id) sedie.get(id)!.hover = true;
          sopra = id;
          const sedia = id ? sedie.get(id)! : null;
          el.style.cursor = sedia && !sedia.occ && !sedia.sposo ? "pointer" : sedia ? "not-allowed" : "grab";
        }
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
      percorso += Math.abs(dx) + Math.abs(dy);
      if (puntatori.size === 1) {
        if (e.shiftKey || e.buttons === 4 || e.buttons === 2) sposta(dx, dy);
        else {
          obj.theta -= dx * 0.005;
          obj.phi -= dy * 0.0035;
          limita();
        }
      } else if (puntatori.size === 2) {
        const [a, b] = [...puntatori.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const centro = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (distPrec) {
          obj.r *= distPrec / dist;
          limita();
        }
        if (centroPrec) sposta(centro.x - centroPrec.x, centro.y - centroPrec.y);
        distPrec = dist;
        centroPrec = centro;
      }
    };
    const su = (e: PointerEvent) => {
      const unico = puntatori.size === 1;
      puntatori.delete(e.pointerId);
      if (puntatori.size < 2) {
        distPrec = 0;
        centroPrec = null;
      }
      el.style.cursor = "grab";
      if (!unico || percorso >= 9 || performance.now() - t0 >= 500) return;
      const hit = colpito(e.clientX, e.clientY);
      if (!hit) return;
      const id = hit.object.userData.id as string;
      const sedia = sedie.get(id)!;
      if (sedia.sposo) cb.current.onAvviso(`Quelle due sedie sono già assegnate. ${SPOSI.lui} e ${SPOSI.lei} insistono.`);
      else if (sedia.occ) cb.current.onAvviso(`Posto già scelto da ${occRef.current.get(id)}. Chiedete di spostarsi, se avete coraggio.`);
      else {
        cb.current.onToggle(id);
        if (obj.r > 24) {
          obj.tx = sedia.g.position.x;
          obj.tz = sedia.g.position.z;
          obj.r = 15;
          limita();
        }
      }
    };
    const annulla = (e: PointerEvent) => puntatori.delete(e.pointerId);
    const esci = () => {
      if (sopra) sedie.get(sopra)!.hover = false;
      sopra = null;
    };
    const rotella = (e: WheelEvent) => {
      e.preventDefault();
      obj.r *= 1 + e.deltaY * 0.0012;
      limita();
    };
    const menu = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", giu);
    el.addEventListener("pointermove", muovi);
    el.addEventListener("pointerup", su);
    el.addEventListener("pointercancel", annulla);
    el.addEventListener("pointerleave", esci);
    el.addEventListener("wheel", rotella, { passive: false });
    el.addEventListener("contextmenu", menu);

    // dimensioni: segue la larghezza del contenitore, altezza adatta a telefono e desktop
    let larghezza = 0;
    let altezzaFin = 0;
    const ridimensiona = () => {
      const w = Math.round(host.getBoundingClientRect().width) || 320;
      const maxH = Math.max(340, Math.min(640, window.innerHeight * 0.66));
      const h = Math.round(Math.min(Math.max(w * (w > 700 ? 0.7 : 0.92), 340), maxH));
      if (w === larghezza && h === altezzaFin) return;
      larghezza = w;
      altezzaFin = h;
      host.style.height = h + "px";
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      renderer.render(scena, cam);
    };
    ridimensiona();
    posizionaCamera();
    const ro = new ResizeObserver(ridimensiona);
    ro.observe(host);
    window.addEventListener("resize", ridimensiona);

    // pausa del rendering quando la sala non è visibile (risparmia batteria)
    let visibile = true;
    const io = new IntersectionObserver(([e]) => (visibile = e.isIntersecting));
    io.observe(host);

    let raf = 0;
    const ciclo = () => {
      raf = requestAnimationFrame(ciclo);
      if (!visibile || document.hidden) return;
      const T = performance.now();
      cur.r += (obj.r - cur.r) * 0.14;
      cur.theta += (obj.theta - cur.theta) * 0.16;
      cur.phi += (obj.phi - cur.phi) * 0.16;
      cur.tx += (obj.tx - cur.tx) * 0.14;
      cur.tz += (obj.tz - cur.tz) * 0.14;
      posizionaCamera();
      lanterne.forEach((l, i) => {
        l.g.position.y = l.base + Math.sin(T * 9e-4 + l.sfasa) * 0.16;
        l.alone.material.opacity = 0.12 + (0.8 + Math.sin(T * 0.004 + i) * 0.2) * 0.1;
      });
      const arr = geoLucciole.attributes.position.array as Float32Array;
      for (let i = 0; i < N; i++) {
        arr[i * 3 + 1] += vel[i];
        arr[i * 3] += Math.sin(T * 6e-4 + i) * 0.0018;
        if (arr[i * 3 + 1] > 7.5) arr[i * 3 + 1] = 0;
      }
      geoLucciole.attributes.position.needsUpdate = true;
      const pulsa = 0.5 + Math.sin(T * 0.004) * 0.32;
      sedie.forEach((s) => {
        const libera = !s.occ && !s.sposo;
        const alto = s.sel ? 0.16 : s.hover && libera ? 0.07 : 0;
        s.g.position.y += (alto - s.g.position.y) * 0.18;
        if (s.sel) {
          s.alone.material.opacity = pulsa;
          s.fiamma.material.opacity = 0.55 + pulsa * 0.4;
          s.fiamma.position.y = 1.5 + Math.sin(T * 0.003) * 0.06;
        } else {
          s.alone.material.opacity = s.hover && libera ? 0.28 : 0;
          s.fiamma.material.opacity = 0;
        }
      });
      renderer.render(scena, cam);
    };
    ciclo();

    const az: AzioniSala = {
      zoom: (f) => {
        obj.r *= f;
        limita();
      },
      reset: () => Object.assign(obj, { r: 31, theta: 0, phi: 0.93, tx: 0, tz: -0.4 }),
      vaiA: (z, r) => {
        Object.assign(obj, { tx: 0, tz: z, r, phi: 0.82, theta: 0 });
        limita();
      },
      vaiATavolo: (x, z) => {
        Object.assign(obj, { tx: x, tz: z, r: 13.5, phi: 0.8 });
        limita();
      },
    };
    azioniLocali.current = az;
    if (azioni) azioni.current = az;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("resize", ridimensiona);
      el.removeEventListener("pointerdown", giu);
      el.removeEventListener("pointermove", muovi);
      el.removeEventListener("pointerup", su);
      el.removeEventListener("pointercancel", annulla);
      el.removeEventListener("pointerleave", esci);
      el.removeEventListener("wheel", rotella);
      el.removeEventListener("contextmenu", menu);
      scena.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => {
          (mt as THREE.MeshStandardMaterial).map?.dispose();
          mt.dispose();
        });
      });
      renderer.dispose();
      el.remove();
      if (azioni) azioni.current = null;
    };
  }, [azioni]);

  // Stato delle sedie: occupate (anche in tempo reale) e selezionate
  useEffect(() => {
    const sel = new Set(selezione.map((p) => p.id));
    sedieRef.current.forEach((s, id) => {
      s.occ = occupati.has(id);
      s.sel = sel.has(id);
      if (s.sposo) return;
      s.mat.color.setHex(s.sel ? COL_SCELTA : s.occ ? COL_OCCUPATA : s.base);
      s.mat.roughness = s.occ ? 0.9 : 0.62;
      s.mat.metalness = s.occ ? 0 : 0.06;
    });
  }, [occupati, selezione]);

  // Etichette "A1 · N liberi": aggiornate quando cambiano le prenotazioni o arriva il font
  useEffect(() => {
    const ridisegna = () =>
      etichetteRef.current.forEach((e, cod) => {
        testoSuTela(e.canvas, `${cod} · ${liberiAlTavolo(cod, occupati)} liberi`, "#7C7A6C");
        e.tex.needsUpdate = true;
      });
    ridisegna();
    let vivo = true;
    document.fonts?.ready.then(() => vivo && ridisegna());
    return () => {
      vivo = false;
    };
  }, [occupati]);

  const az = () => azioniLocali.current;
  return (
    <div className="scena">
      <div ref={tela} className="tela" />
      <div className="scena-cmd">
        <button className="cmd" onClick={() => az()?.zoom(0.72)} aria-label="Avvicina" title="Avvicina">
          <Plus size={15} />
        </button>
        <button className="cmd" onClick={() => az()?.zoom(1.38)} aria-label="Allontana" title="Allontana">
          <Minus size={15} />
        </button>
        <button className="cmd" onClick={() => az()?.reset()} aria-label="Vista intera" title="Vista intera">
          <Maximize size={15} />
        </button>
      </div>
      <div className="zone-bar">
        <button className="chip-zona" onClick={() => az()?.reset()}>
          <Maximize size={12} /> Tutta la sala
        </button>
        {ZONE.map((z) => (
          <button key={z.k} className="chip-zona" onClick={() => az()?.vaiA(z.z, z.r)}>
            <i style={{ background: SETTORI[z.k].col }} /> {SETTORI[z.k].nome}
          </button>
        ))}
      </div>
      <p className="scena-nota">
        <span className="solo-touch">Un dito per girare · due dita per zoom e spostamento · tocca una sedia per sceglierla</span>
        <span className="solo-mouse">Trascina per girare · rotellina per lo zoom · Maiusc+trascina per spostarti · clic su una sedia</span>
      </p>
    </div>
  );
}
