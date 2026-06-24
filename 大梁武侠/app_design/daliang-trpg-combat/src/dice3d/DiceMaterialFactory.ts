import * as THREE from "three";
import type { DiceAffinity } from "./diceTypes";
import onyxColorUrl from "../assets/materials/ambientcg/Onyx015_1K-JPG/Onyx015_1K-JPG_Color.jpg";
import onyxNormalUrl from "../assets/materials/ambientcg/Onyx015_1K-JPG/Onyx015_1K-JPG_NormalGL.jpg";
import onyxRoughnessUrl from "../assets/materials/ambientcg/Onyx015_1K-JPG/Onyx015_1K-JPG_Roughness.jpg";
import marbleColorUrl from "../assets/materials/ambientcg/Marble012_1K-JPG/Marble012_1K-JPG_Color.jpg";
import marbleNormalUrl from "../assets/materials/ambientcg/Marble012_1K-JPG/Marble012_1K-JPG_NormalGL.jpg";
import marbleRoughnessUrl from "../assets/materials/ambientcg/Marble012_1K-JPG/Marble012_1K-JPG_Roughness.jpg";
import metalColorUrl from "../assets/materials/ambientcg/Metal007_1K-JPG/Metal007_1K-JPG_Color.jpg";
import metalNormalUrl from "../assets/materials/ambientcg/Metal007_1K-JPG/Metal007_1K-JPG_NormalGL.jpg";
import metalRoughnessUrl from "../assets/materials/ambientcg/Metal007_1K-JPG/Metal007_1K-JPG_Roughness.jpg";
import metalMetalnessUrl from "../assets/materials/ambientcg/Metal007_1K-JPG/Metal007_1K-JPG_Metalness.jpg";

export interface DiceVisualTheme {
  body: string;
  bodyAlt: string;
  edge: string;
  line: string;
  number: string;
  glow: string;
  resultBackground: string;
  resultText: string;
  roughness: number;
  metalness: number;
  normalStrength: number;
  envMapIntensity: number;
}

const textureLoader = new THREE.TextureLoader();

const THEMES: Record<DiceAffinity, DiceVisualTheme> = {
  yin: {
    body: "#050505",
    bodyAlt: "#242424",
    edge: "#f5f4ee",
    line: "#d8d8d0",
    number: "#ffffff",
    glow: "#151515",
    resultBackground: "rgba(5, 5, 5, 0.72)",
    resultText: "#ffffff",
    roughness: 0.36,
    metalness: 0.16,
    normalStrength: 0.18,
    envMapIntensity: 1.55,
  },
  yang: {
    body: "#f8f4e9",
    bodyAlt: "#ffffff",
    edge: "#060606",
    line: "#27231d",
    number: "#050505",
    glow: "#ffffff",
    resultBackground: "rgba(252, 248, 238, 0.76)",
    resultText: "#050505",
    roughness: 0.43,
    metalness: 0.02,
    normalStrength: 0.12,
    envMapIntensity: 1.35,
  },
  raw: {
    body: "#0d53c7",
    bodyAlt: "#45a6ff",
    edge: "#f0c24f",
    line: "#d8a736",
    number: "#ffd76b",
    glow: "#0b2d73",
    resultBackground: "rgba(7, 35, 95, 0.72)",
    resultText: "#ffd76b",
    roughness: 0.31,
    metalness: 0.2,
    normalStrength: 0.16,
    envMapIntensity: 1.7,
  },
};

export function getDiceTheme(affinity: DiceAffinity): DiceVisualTheme {
  return THEMES[affinity];
}

export function createDiceBodyMaterial(affinity: DiceAffinity): THREE.MeshStandardMaterial {
  const theme = getDiceTheme(affinity);
  const urls = getMaterialUrls(affinity);
  const map = loadExternalTexture(urls.color, true);
  const roughnessMap = loadExternalTexture(urls.roughness, false);
  const normalMap = loadExternalTexture(urls.normal, false);
  const metalnessMap = urls.metalness ? loadExternalTexture(urls.metalness, false) : undefined;

  return new THREE.MeshStandardMaterial({
    color: theme.body,
    map,
    roughnessMap,
    metalnessMap,
    normalMap,
    normalScale: new THREE.Vector2(theme.normalStrength, theme.normalStrength),
    roughness: theme.roughness,
    metalness: theme.metalness,
    emissive: new THREE.Color(theme.glow),
    emissiveIntensity: affinity === "yang" ? 0.035 : 0.055,
    envMapIntensity: theme.envMapIntensity,
    flatShading: true,
  });
}

function getMaterialUrls(affinity: DiceAffinity) {
  if (affinity === "yang") {
    return { color: marbleColorUrl, normal: marbleNormalUrl, roughness: marbleRoughnessUrl };
  }
  if (affinity === "raw") {
    return { color: metalColorUrl, normal: metalNormalUrl, roughness: metalRoughnessUrl, metalness: metalMetalnessUrl };
  }
  return { color: onyxColorUrl, normal: onyxNormalUrl, roughness: onyxRoughnessUrl };
}

function loadExternalTexture(url: string, isColor: boolean): THREE.Texture {
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.65, 1.65);
  texture.anisotropy = 4;
  if (isColor) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

export function createFaceTexture(value: number, affinity: DiceAffinity): THREE.CanvasTexture {
  const theme = getDiceTheme(affinity);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, size, size);
    drawArtifactOrnaments(context, theme, value, affinity, size);
    drawEngravedNumber(context, theme, value, size);
  }

  return toTexture(canvas);
}

function createStoneTexture(theme: DiceVisualTheme): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    drawStoneBase(context, theme, size, 1);
  }
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.8, 1.8);
  return texture;
}

function createRoughnessTexture(affinity: DiceAffinity): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(size, size);
    for (let index = 0; index < image.data.length; index += 4) {
      const value = affinity === "yang" ? 150 + Math.random() * 55 : 105 + Math.random() * 80;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createNormalTexture(affinity: DiceAffinity): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(size, size);
    for (let index = 0; index < image.data.length; index += 4) {
      const variance = affinity === "raw" ? 18 : 12;
      image.data[index] = 128 + (Math.random() - 0.5) * variance;
      image.data[index + 1] = 128 + (Math.random() - 0.5) * variance;
      image.data[index + 2] = 255;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function drawStoneBase(context: CanvasRenderingContext2D, theme: DiceVisualTheme, size: number, alpha: number) {
  const gradient = context.createRadialGradient(size * 0.3, size * 0.25, 10, size * 0.5, size * 0.5, size * 0.82);
  gradient.addColorStop(0, withAlpha(theme.bodyAlt, alpha));
  gradient.addColorStop(0.48, withAlpha(theme.body, alpha));
  gradient.addColorStop(1, withAlpha(theme.bodyAlt, alpha));
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 34; i += 1) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    context.strokeStyle = withAlpha(theme.line, 0.06 + Math.random() * 0.1);
    context.lineWidth = 1 + Math.random() * 2;
    context.beginPath();
    context.moveTo(x - 40, y);
    context.bezierCurveTo(x - 8, y - 16, x + 12, y + 18, x + 48, y - 4);
    context.stroke();
  }
}

function drawArtifactOrnaments(
  context: CanvasRenderingContext2D,
  theme: DiceVisualTheme,
  value: number,
  affinity: DiceAffinity,
  size: number,
) {
  const random = seededRandom(`${affinity}-${value}`);
  const center = size / 2;
  const safeRadius = size * 0.31;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  for (let i = 0; i < 34; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = safeRadius + random() * size * 0.23;
    const length = size * (0.045 + random() * 0.075);
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const tangent = angle + Math.PI / 2 + (random() - 0.5) * 0.7;
    context.strokeStyle = withAlpha(theme.line, 0.16 + random() * 0.18);
    context.lineWidth = 1.1 + random() * 1.8;
    context.beginPath();
    context.moveTo(x - Math.cos(tangent) * length, y - Math.sin(tangent) * length);
    context.quadraticCurveTo(
      x + Math.cos(angle) * length * 0.2,
      y + Math.sin(angle) * length * 0.2,
      x + Math.cos(tangent) * length,
      y + Math.sin(tangent) * length,
    );
    context.stroke();
  }

  const cornerColor = affinity === "yin" ? "#cfd0ca" : affinity === "yang" ? "#3a342b" : theme.edge;
  const corners = [
    { x: size * 0.18, y: size * 0.18, sx: 1, sy: 1 },
    { x: size * 0.82, y: size * 0.18, sx: -1, sy: 1 },
    { x: size * 0.18, y: size * 0.82, sx: 1, sy: -1 },
    { x: size * 0.82, y: size * 0.82, sx: -1, sy: -1 },
  ];

  for (const corner of corners) {
    context.strokeStyle = withAlpha(cornerColor, 0.28);
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(corner.x, corner.y);
    context.lineTo(corner.x + corner.sx * size * 0.105, corner.y);
    context.moveTo(corner.x, corner.y);
    context.lineTo(corner.x, corner.y + corner.sy * size * 0.105);
    context.stroke();

    context.strokeStyle = withAlpha(theme.bodyAlt, 0.26);
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(corner.x + corner.sx * size * 0.035, corner.y + corner.sy * size * 0.035);
    context.lineTo(corner.x + corner.sx * size * 0.135, corner.y + corner.sy * size * 0.035);
    context.moveTo(corner.x + corner.sx * size * 0.035, corner.y + corner.sy * size * 0.035);
    context.lineTo(corner.x + corner.sx * size * 0.035, corner.y + corner.sy * size * 0.135);
    context.stroke();
  }

  for (let i = 0; i < 26; i += 1) {
    const side = Math.floor(random() * 4);
    const t = size * (0.13 + random() * 0.74);
    const inset = size * (0.055 + random() * 0.045);
    const x = side < 2 ? t : side === 2 ? inset : size - inset;
    const y = side < 2 ? (side === 0 ? inset : size - inset) : t;
    const length = size * (0.025 + random() * 0.05);
    const horizontal = side < 2;
    context.strokeStyle = withAlpha(theme.edge, 0.18 + random() * 0.18);
    context.lineWidth = 1 + random() * 1.2;
    context.beginPath();
    context.moveTo(x - (horizontal ? length : 0), y - (horizontal ? 0 : length));
    context.lineTo(x + (horizontal ? length : 0), y + (horizontal ? 0 : length));
    context.stroke();
  }

  context.restore();
}

function drawEngravedNumber(context: CanvasRenderingContext2D, theme: DiceVisualTheme, value: number, size: number) {
  const text = String(value);
  const fontSize = text.length >= 2 ? size * 0.52 : size * 0.66;
  const centerX = size / 2;
  const centerY = size / 2 + (text.length >= 2 ? size * 0.025 : size * 0.02);

  context.font = `900 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowColor = withAlpha("#000000", 0.58);
  context.shadowBlur = size * 0.038;
  context.shadowOffsetX = size * 0.018;
  context.shadowOffsetY = size * 0.028;
  context.strokeStyle = withAlpha(theme.body, 0.82);
  context.lineWidth = size * 0.075;
  context.strokeText(text, centerX, centerY);
  context.restore();

  context.save();
  context.lineJoin = "round";
  context.strokeStyle = withAlpha(theme.bodyAlt, 0.62);
  context.lineWidth = size * 0.038;
  context.strokeText(text, centerX - size * 0.014, centerY - size * 0.018);
  context.restore();

  context.save();
  context.lineJoin = "round";
  context.strokeStyle = withAlpha("#000000", 0.44);
  context.lineWidth = size * 0.026;
  context.strokeText(text, centerX + size * 0.012, centerY + size * 0.018);
  context.fillStyle = theme.number;
  context.globalAlpha = 0.96;
  context.fillText(text, centerX, centerY);
  context.restore();

  context.save();
  context.lineJoin = "round";
  context.strokeStyle = withAlpha(theme.body, 0.32);
  context.lineWidth = size * 0.01;
  for (let i = 0; i < 5; i += 1) {
    context.strokeText(text, centerX + (i - 2) * 0.7, centerY + (2 - i) * 0.5);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.36;
  context.fillStyle = withAlpha(theme.edge, 0.5);
  context.fillText(text, centerX - size * 0.01, centerY - size * 0.014);
  context.restore();
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function withAlpha(hex: string, alpha: number): string {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function seededRandom(seed: string): () => number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
