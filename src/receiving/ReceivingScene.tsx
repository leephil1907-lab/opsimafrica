import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  HandGesture,
  deliveryPosition,
  stockPosition,
  dropZone,
  pokeInside,
  zones,
} from './gestures';
import type { Carton, LabSceneHandle, SceneState, Zone } from './types';
import { WarehouseArt } from '../components/ui';

interface Props {
  state: SceneState;
  onAction: (id: string) => void;
  onDrop: (id: string, zone: Zone) => Promise<boolean>;
  onXRChange: (active: boolean, mode?: string) => void;
  onReady: (ready: boolean) => void;
  onFocusLoss: () => void;
  onNotice: (message: string) => void;
}
interface Runtime {
  mode: string;
  renderer: THREE.WebGLRenderer;
  bringCloser: () => void;
  sync: (state: SceneState) => void;
  reset: () => void;
}
interface Held {
  object: THREE.Object3D;
  near: boolean;
  distance: number;
  offset: THREE.Vector3;
  gesture: 'pinch' | 'grip';
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
}
function texture(
  text: string,
  bg = '#f6f7eb',
  fg = '#2e4534',
  width = 768,
  height = 192,
  font = 34,
  align: CanvasTextAlign = 'center',
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  ctx.font = `500 ${font}px Arial`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > width - 38 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  const step = font * 1.35;
  const max = Math.floor((height - 16) / step);
  lines
    .slice(0, max)
    .forEach((line, i) =>
      ctx.fillText(
        line,
        align === 'left' ? 19 : width / 2,
        height / 2 + (i - (Math.min(max, lines.length) - 1) / 2) * step,
      ),
    );
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
function disposeMesh(object: THREE.Object3D) {
  object.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    if (m.material) {
      for (const material of Array.isArray(m.material) ? m.material : [m.material]) {
        if ('map' in material) (material as THREE.MeshBasicMaterial).map?.dispose();
        material.dispose();
      }
    }
  });
}

export const ReceivingScene = forwardRef<LabSceneHandle, Props>(function ReceivingScene(
  { state, onAction, onDrop, onXRChange, onFocusLoss, onNotice, onReady },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const live = useRef({ state, onAction, onDrop, onXRChange, onFocusLoss, onNotice });
  live.current = { state, onAction, onDrop, onXRChange, onFocusLoss, onNotice };
  const [fallback, setFallback] = useState(false);
  useImperativeHandle(
    ref,
    () => ({
      bringCloser() {
        runtime.current?.bringCloser();
      },
      async enter(mode) {
        if (!runtime.current || !navigator.xr)
          throw new Error('Open the direct HTTPS URL in a WebXR-compatible headset browser.');
        const xr = await navigator.xr.requestSession(mode, {
          optionalFeatures: ['local-floor', 'hand-tracking', 'bounded-floor'],
        });
        runtime.current.mode = mode;
        try {
          await runtime.current.renderer.xr.setSession(xr);
        } catch (error) {
          await xr.end();
          throw error;
        }
      },
      async exit() {
        await runtime.current?.renderer.xr.getSession()?.end();
      },
      reset() {
        runtime.current?.reset();
      },
    }),
    [],
  );
  useEffect(() => {
    runtime.current?.sync(state);
  }, [state]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.xr.enabled = true;
    host.appendChild(renderer.domElement);
    const bright = live.current.state.theme === 'brightmart';
    const boardBg = bright ? '#1B2027' : '#263e31';
    const boardText = bright ? '#E8EDF2' : '#e3ebd4';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bright ? '#EDF1F4' : '#e8ecdf');
    const camera = new THREE.PerspectiveCamera(43, 1, 0.035, 35);
    const rig = new THREE.Group();
    rig.add(camera);
    scene.add(rig);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.77, -0.05);
    controls.minDistance = 3.2;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.enableDamping = true;
    function reset() {
      controls.minDistance = 3.2;
      camera.fov = 43;
      camera.updateProjectionMatrix();
      camera.position.set(4.35, 4.3, 5.9);
      controls.target.set(0, 0.77, -0.05);
      controls.update();
    }
    reset();
    scene.add(new THREE.HemisphereLight('#fffdf0', '#6f8267', 1.8));
    const sunlight = new THREE.DirectionalLight('#fff9df', 3);
    sunlight.position.set(3, 7, 5);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    Object.assign(sunlight.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
    sunlight.shadow.normalBias = 0.035;
    scene.add(sunlight);
    const room = new THREE.Group();
    scene.add(room);
    const furniture = new THREE.Group();
    scene.add(furniture);
    const cartons = new THREE.Group();
    scene.add(cartons);
    const docGroup = new THREE.Group();
    scene.add(docGroup);
    function box(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
      parent: THREE.Object3D = furniture,
      opacity = 1,
    ) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.8,
          transparent: opacity < 1,
          opacity,
        }),
      );
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    function sign(
      text: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      bg = '#f6f7eb',
      fg = '#2e4534',
      parent: THREE.Object3D = furniture,
      font = 32,
    ) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: texture(text, bg, fg, 768, Math.max(90, Math.round((768 * h) / w)), font),
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }
    box(0, -0.07, 0, 5.6, 0.14, 4.8, bright ? '#DDE3E8' : '#c9d1bd', room);
    box(0, 1.35, -2.3, 5.6, 2.7, 0.1, bright ? '#E7ECEF' : '#c1cfb1', room);
    box(-2.75, 1.1, -0.6, 0.1, 2.2, 3.4, bright ? '#D1DCDD' : '#b6c7a5', room);
    sign(
      bright ? 'BRIGHTMART  /  RECEIVING & SHELF CHECK' : 'RECEIVING LAB  /  MAINLAND RETAIL',
      0,
      2.3,
      -2.24,
      2.8,
      0.18,
      bright ? '#E7ECEF' : '#c1cfb1',
      bright ? '#30465A' : '#3a5533',
      room,
    );
    for (const [key, zone] of Object.entries(zones)) {
      const [x, , z] = zone.center;
      const color = zone.color;
      if (key !== 'quarantine') {
        for (const dx of [-0.62, 0.62])
          for (const dz of [-0.34, 0.34])
            box(
              x + dx,
              1.0,
              z + dz,
              0.045,
              2,
              0.045,
              bright ? '#657A86' : key === 'cold' ? '#648f9a' : '#617b4d',
            );
        for (const y of [0.7, 1.24, 1.78])
          box(
            x,
            y,
            z,
            1.35,
            0.05,
            0.79,
            bright ? '#BED1C9' : key === 'cold' ? '#cce3e4' : '#a0b485',
          );
        if (key === 'cold' && !bright)
          box(x, 1.17, z - 0.36, 1.32, 1.5, 0.025, '#7fadb8', furniture, 0.3);
        sign(
          bright
            ? key === 'cold'
              ? 'GROCERY & HOUSEHOLD'
              : 'HEALTH & WELLNESS'
            : key === 'cold'
              ? 'COLD STORAGE  /  CHILLED'
              : 'DRY STOCK  /  SELLABLE',
          x,
          2.08,
          z + 0.39,
          1.3,
          0.2,
          bright ? '#263D4B' : key === 'cold' ? '#466e79' : '#3f5c31',
          '#f6f7e9',
        );
      } else {
        box(x, 0.75, z, 1.38, 0.09, 0.9, bright ? '#BD7466' : '#bb8a51');
        for (const dx of [-0.56, 0.56])
          for (const dz of [-0.32, 0.32]) box(x + dx, 0.36, z + dz, 0.06, 0.72, 0.06, '#8e704c');
        box(x, 0.81, z + 0.39, 1.38, 0.08, 0.04, '#c89e65');
        sign(
          'QUARANTINE / RETURNS',
          x,
          0.65,
          z + 0.46,
          1.26,
          0.17,
          bright ? '#913F39' : '#a4713e',
          bright ? '#FFF3EE' : '#fff6df',
        );
      }
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(1.38, 0.9),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, key === 'quarantine' ? 0.813 : 0.729, z);
      furniture.add(ring);
    }
    box(0, 0.76, 0.06, 1.93, 0.1, 0.94, '#ba9c71');
    for (const x of [-0.83, 0.83])
      for (const z of [-0.3, 0.4]) box(x, 0.36, z, 0.06, 0.72, 0.06, '#61764e');
    sign('DELIVERY TABLE', 0, 0.6, 0.54, 1.6, 0.18, '#526b40', '#fff9df');
    for (let i = 0; i < 5; i++) box(-0.65 + i * 0.31, 0.008, 1.1, 0.16, 0.014, 0.035, '#c1ab63');
    // Batch static, same-colour fixtures so XR does not pay a draw call per shelf leg.
    scene.updateMatrixWorld(true);
    const batches = new Map<string, THREE.Mesh[]>();
    for (const object of [...furniture.children]) {
      const mesh = object as THREE.Mesh;
      if (
        mesh.geometry?.type === 'BoxGeometry' &&
        mesh.material instanceof THREE.MeshStandardMaterial
      ) {
        const key = mesh.material.color.getHexString() + ':' + mesh.material.opacity;
        const group = batches.get(key) || [];
        group.push(mesh);
        batches.set(key, group);
      }
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
      const geometry = mergeGeometries(geometries);
      if (geometry) {
        const merged = new THREE.Mesh(geometry, meshes[0].material);
        merged.castShadow = true;
        merged.receiveShadow = true;
        furniture.add(merged);
        for (const mesh of meshes) {
          furniture.remove(mesh);
          mesh.geometry.dispose();
          if (mesh !== meshes[0]) (mesh.material as THREE.Material).dispose();
        }
      }
      geometries.forEach((g) => g.dispose());
    }
    const board = new THREE.Group();
    board.visible = false;
    scene.add(board);
    const boardContent = new THREE.Group();
    board.add(boardContent);
    const boardButtons: THREE.Object3D[] = [];
    let boardKey = '';
    const boardHandle = box(0, 0.67, 0, 0.9, 0.075, 0.035, '#294534', board);
    boardHandle.userData = { kind: 'tablet', root: board };
    sign('GRAB TO MOVE TABLET', 0, 0.67, 0.024, 0.8, 0.05, '#294534', '#dceec5', board, 24);
    let clockMesh: THREE.Mesh | null = null;
    const invoiceRoot = new THREE.Group();
    invoiceRoot.position.set(-1.12, 1.05, 0.5);
    invoiceRoot.rotation.x = -0.45;
    docGroup.add(invoiceRoot);
    let invoiceMesh: THREE.Mesh | null = null;
    invoiceRoot.userData = { kind: 'document', id: 'invoice' };
    const objects = new Map<string, THREE.Group>();
    const targets = new Map<string, THREE.Vector3>();
    const inspectionPositions = new Map<string, THREE.Vector3>();
    const inspectionRotations = new Map<string, THREE.Quaternion>();
    let manifestKey = '';
    let lastSync = 0;
    const fallbackItems: Carton[] = Array.from({ length: bright ? 8 : 10 }, (_, i) => ({
      id: `C${String(i + 1).padStart(2, '0')}`,
      name: (bright
        ? ['Paracetamol', 'Sanitiser', 'Rice', 'Laundry soap']
        : ['Golden Grain Rice', 'Fresh Milk', 'Honey Beans', 'SunGold Oil'])[i % 4],
      printedSku: ['RCE-01', 'MLK-02', 'BNS-03', 'OIL-04'][i % 4],
      condition: i === 4 ? 'crushed seal' : 'sealed',
      sku: 'PREVIEW',
      storage: 'dry',
      expiry: '2027-06-30',
      actualUnits: 12,
      expectedUnits: 12,
      batch: 'BM261108-PREVIEW',
    }));
    function updateItems(s: SceneState) {
      const items = s.run?.manifest.items || fallbackItems;
      const key = (s.run?.id || 'preview') + ':' + items.length;
      if (key !== manifestKey) {
        manifestKey = key;
        for (const o of [...cartons.children]) {
          disposeMesh(o);
          cartons.remove(o);
        }
        objects.clear();
        targets.clear();
        inspectionPositions.clear();
        inspectionRotations.clear();
        items.forEach((item, i) => {
          const g = new THREE.Group();
          cartons.add(g);
          g.position.set(...deliveryPosition(i));
          g.userData = { kind: 'carton', id: item.id, held: false, awaiting: false };
          const productColor = item.name.includes('Milk')
            ? '#b5cdd0'
            : item.name.includes('Oil')
              ? '#ccb576'
              : item.name.includes('Beans')
                ? '#b2bd90'
                : '#d1b489';
          box(0, 0, 0, 0.225, 0.255, 0.225, productColor, g);
          box(0, 0.13, 0, 0.035, 0.007, 0.225, '#eee0bc', g);
          sign(
            `${item.id}\n${item.printedSku}`,
            0,
            0.012,
            0.115,
            0.19,
            0.12,
            '#faf7e8',
            '#304b32',
            g,
            38,
          );
          const side = sign(
            `EXP ${item.expiry}\n${bright ? 'BATCH ' + (item.batch || 'BM261108') : item.name.includes('Milk') ? 'KEEP CHILLED' : 'KEEP DRY'}\n${item.condition}`,
            0.114,
            0,
            0,
            0.2,
            0.19,
            '#f4f1de',
            '#304b32',
            g,
            30,
          );
          side.rotation.y = Math.PI / 2;
          const back = sign(
            `${item.name}\nSKU ${item.printedSku}\n${bright ? item.actualUnits + ' UNITS' : '1 CARTON'}`,
            0,
            0,
            -0.114,
            0.2,
            0.19,
            '#f4f1de',
            '#304b32',
            g,
            30,
          );
          back.rotation.y = Math.PI;
          if (
            bright ? /crushed|wet|opened|broken/i.test(item.condition) : item.condition !== 'sealed'
          ) {
            const crack = box(0.055, 0.045, 0.119, 0.012, 0.17, 0.004, '#ad5941', g);
            crack.rotation.z = 0.43;
          }
          objects.set(item.id, g);
        });
        if (invoiceMesh) {
          disposeMesh(invoiceMesh);
          invoiceRoot.remove(invoiceMesh);
        }
        const m = s.run?.manifest;
        const lines = m
          ? `${m.deliveryId}  ·  ${m.supplier}\nINSPECTION: ${m.inspectionDate}\n${m.invoice.map((row) => `${row.sku}  ${row.name}  ${row.expected}${bright ? ' units' : ' cartons'}`).join('\n')}\nORDERED: ${m.expected} CARTONS`
          : bright
            ? 'DELIVERY NOTE · BM-2047\n8 cartons · Coastal Supply Partners\n08 Nov 2026 · Count actual units\nHealth & Wellness / Grocery & Household\nIsolate damaged, expired, mismatched stock'
            : 'PURCHASE ORDER · NG-2047\n10 cartons ordered\nInspect labels, seals and expiry.\nDry stock / Cold stock / Quarantine';
        invoiceMesh = sign(lines, 0, 0, 0, 0.55, 0.7, '#faf7e9', '#344e32', invoiceRoot, 27);
        invoiceMesh.userData = { kind: 'document', root: invoiceRoot };
      }
      const counts = { dry: 0, cold: 0, quarantine: 0 };
      for (const item of items) {
        const p = s.run?.placements[item.id];
        if (p) {
          inspectionPositions.delete(item.id);
          inspectionRotations.delete(item.id);
        }
        targets.set(
          item.id,
          new THREE.Vector3(
            ...(p
              ? stockPosition(p.zone, counts[p.zone]++)
              : inspectionPositions.get(item.id)?.toArray() ||
                deliveryPosition(items.indexOf(item))),
          ),
        );
        const o = objects.get(item.id)!;
        o.userData.placed = Boolean(p);
        o.userData.inspected = s.run?.inspected.includes(item.id);
      }
    }
    function updateBoard(s: SceneState) {
      const { clock: _, ...v } = s.view;
      const key = JSON.stringify(v);
      if (key === boardKey) return;
      boardKey = key;
      for (const o of [...boardContent.children]) {
        disposeMesh(o);
        boardContent.remove(o);
      }
      boardButtons.length = 0;
      const vCurrent = s.view;
      box(0, 0, 0, 0.94, 1.3, 0.028, boardBg, boardContent);
      sign(
        vCurrent.eyebrow,
        0,
        0.576,
        0.022,
        0.86,
        0.07,
        boardBg,
        bright ? '#80D9B6' : '#c9dfab',
        boardContent,
        25,
      );
      sign(vCurrent.title, 0, 0.476, 0.022, 0.86, 0.13, boardBg, boardText, boardContent, 35);
      const lines = vCurrent.lines.slice(0, 8).join('\n');
      sign(lines, 0, 0.25, 0.023, 0.86, 0.3, boardBg, boardText, boardContent, 26);
      const cols = vCurrent.columns || 3,
        rows = Math.ceil(vCurrent.buttons.length / cols),
        buttonHeight = Math.min(0.12, (0.55 - Math.max(0, rows - 1) * 0.009) / Math.max(1, rows));
      const top = 0.047;
      const width = 0.86 / cols - 0.012;
      vCurrent.buttons.forEach((b, i) => {
        const bg = b.disabled
          ? '#4a5a47'
          : b.style === 'primary'
            ? bright
              ? '#00A86B'
              : '#d7ecb4'
            : b.style === 'warning'
              ? bright
                ? '#F2A93B'
                : '#efc38e'
              : b.style === 'active'
                ? bright
                  ? '#75D2AC'
                  : '#b5d492'
                : bright
                  ? '#E8EDF2'
                  : '#ecf1e1';
        const fg = b.disabled ? '#D2DBD1' : bright ? '#0F1B2A' : '#2b4330';
        const x = ((i % cols) - (cols - 1) / 2) * (0.86 / cols),
          y = top - Math.floor(i / cols) * (buttonHeight + 0.009);
        const mesh = sign(
          b.label,
          x,
          y,
          0.029,
          width,
          buttonHeight,
          bg,
          fg,
          boardContent,
          Math.round((0.026 / width) * 768),
        );
        mesh.userData = {
          label: b.label,
          kind: 'button',
          id: b.id,
          width,
          height: buttonHeight,
          disabled: b.disabled || vCurrent.busy,
        };
        boardButtons.push(mesh);
      });
      const feedback = vCurrent.feedback;
      sign(
        feedback
          ? (feedback.correct ? '✓ ' : '! ') + feedback.message
          : vCurrent.paused
            ? 'Paused. Resume when you are ready.'
            : 'Point + pinch • Poke buttons • Grab / drag cartons',
        0,
        -0.574,
        0.031,
        0.86,
        0.12,
        feedback?.correct === false ? '#6b4d31' : boardBg,
        bright ? '#E8EDF2' : '#e4efcf',
        boardContent,
        22,
      );
      clockMesh = sign(
        vCurrent.clock || 'OPS SIM  /  HANDS FIRST',
        0,
        -0.642,
        0.032,
        0.83,
        0.055,
        boardBg,
        bright ? '#A9B4BF' : '#c6dcaa',
        boardContent,
        25,
      );
    }
    const taskPanel = new THREE.Group();
    taskPanel.visible = false;
    scene.add(taskPanel);
    let taskKey = '';
    const taskButtons: THREE.Object3D[] = [];
    const nearHint = sign(
      'PINCH / GRAB TO INSPECT',
      0,
      0,
      0,
      0.37,
      0.05,
      '#1B2027',
      '#E8EDF2',
      scene,
      25,
    );
    nearHint.visible = false;
    let lastComfort = '';
    function positionPanels(s: SceneState) {
      if (!renderer.xr.isPresenting) return;
      const eye = camera.getWorldPosition(new THREE.Vector3());
      const yaw = new THREE.Euler().setFromQuaternion(
        camera.getWorldQuaternion(new THREE.Quaternion()),
        'YXZ',
      ).y;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const dist = s.comfort?.distance || 'standard',
        seated = s.comfort?.seated;
      const offset =
        dist === 'near'
          ? new THREE.Vector3(-0.42, seated ? -0.08 : -0.15, -0.75)
          : dist === 'far'
            ? new THREE.Vector3(-0.7, seated ? -0.12 : -0.24, -1.35)
            : new THREE.Vector3(-0.65, seated ? -0.1 : -0.18, -1.14);
      board.position.copy(eye).add(offset.applyQuaternion(q));
      board.quaternion
        .copy(q)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.25));
      board.scale.setScalar((dist === 'near' ? 0.82 : 1) * (s.comfort?.largeText ? 1.12 : 1));
      taskPanel.position.copy(eye).add(new THREE.Vector3(0.05, 0.38, -1.8).applyQuaternion(q));
      taskPanel.quaternion.copy(q);
    }
    function updateTask(s: SceneState) {
      if (!bright || !s.hud) return;
      const key = JSON.stringify(s.hud);
      if (key !== taskKey) {
        taskKey = key;
        for (const o of [...taskPanel.children]) {
          disposeMesh(o);
          taskPanel.remove(o);
        }
        taskButtons.length = 0;
        box(0, 0, 0, 1.4, 0.49, 0.022, '#1B2027', taskPanel);
        sign('CURRENT OBJECTIVE', 0, 0.185, 0.018, 1.3, 0.055, '#1B2027', '#A9B4BF', taskPanel, 24);
        sign(s.hud.objective, 0, 0.1, 0.018, 1.3, 0.12, '#1B2027', '#E8EDF2', taskPanel, 38);
        sign(
          s.hud.progress + '  |  ' + s.hud.timer,
          0,
          0.012,
          0.019,
          1.3,
          0.055,
          '#1B2027',
          '#A9B4BF',
          taskPanel,
          25,
        );
        const buttons = [
          ...(s.hud.action ? [s.hud.action] : []),
          { id: 'hint', label: 'Hint', style: 'subtle' as const },
        ];
        buttons.forEach((b, i) => {
          const m = sign(
            b.label,
            i === 0 ? -0.21 : 0.48,
            -0.1,
            0.021,
            i === 0 ? 0.86 : 0.32,
            0.1,
            b.style === 'primary' ? '#00A86B' : '#2A323C',
            b.style === 'primary' ? '#0F1B2A' : '#E8EDF2',
            taskPanel,
            30,
          );
          m.userData = {
            kind: 'button',
            id: b.id,
            label: b.label,
            width: i === 0 ? 0.86 : 0.32,
            height: 0.1,
            disabled: b.disabled || s.view.busy,
          };
          taskButtons.push(m);
        });
        sign(s.hud.hint, 0, -0.205, 0.021, 1.3, 0.06, '#1B2027', '#A9B4BF', taskPanel, 22);
      }
      const comfort = JSON.stringify(s.comfort);
      if (comfort !== lastComfort) {
        lastComfort = comfort;
        positionPanels(s);
      }
    }
    function bringCloser() {
      const id = live.current.state.selectedId;
      if (!id) return;
      const object = objects.get(id);
      if (!object || object.userData.placed || object.userData.held) return;
      if (renderer.xr.isPresenting) {
        const eye = camera;
        const q = eye.getWorldQuaternion(new THREE.Quaternion());
        const target = eye
          .getWorldPosition(new THREE.Vector3())
          .add(new THREE.Vector3(0.18, -0.32, -0.48).applyQuaternion(q));
        inspectionPositions.set(id, target);
        inspectionRotations.set(id, q);
        targets.set(id, target);
      } else {
        controls.minDistance = 0.65;
        controls.target.copy(object.position);
        camera.position.copy(object.position).add(new THREE.Vector3(0.65, 0.6, 1.05));
        controls.update();
      }
    }
    function sync(s: SceneState) {
      updateItems(s);
      updateBoard(s);
      updateTask(s);
      lastSync = Date.now();
    }
    sync(live.current.state);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      worldPoint = new THREE.Vector3();
    const held: Array<Held | null> = [null, null];
    const handGestures = [new HandGesture(), new HandGesture()];
    const pokeLatch = [new Set<string>(), new Set<string>()];
    const pokeArmed = [true, true];
    const handRays: THREE.Line[] = [];
    const hands: THREE.XRHandSpace[] = [];
    const controllers: THREE.XRTargetRaySpace[] = [];
    const matrix = new THREE.Matrix4();
    let lastClick = 0;
    let drag: { object: THREE.Object3D; x: number; y: number; active: boolean } | null = null;
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.95);
    const highlight = new THREE.BoxHelper(new THREE.Mesh(), '#f7e2a0');
    highlight.visible = false;
    scene.add(highlight);
    function rootOf(o: THREE.Object3D): THREE.Object3D | null {
      let p: THREE.Object3D | null = o;
      while (p && !p.userData.kind) p = p.parent;
      return p;
    }
    function activeTargets() {
      return [
        ...(board.visible ? [...boardButtons, boardHandle] : []),
        ...(taskPanel.visible ? taskButtons : []),
        ...(live.current.state.interactive ? [...objects.values()] : []),
        ...(invoiceMesh ? [invoiceMesh] : []),
      ];
    }
    function hit(origin: THREE.Vector3, direction: THREE.Vector3) {
      ray.set(origin, direction);
      const h = ray.intersectObjects(activeTargets(), true).find((h) => {
        const o = rootOf(h.object);
        return o && !o.userData.disabled;
      });
      return h ? { object: rootOf(h.object)!, distance: h.distance } : null;
    }
    function action(id: string) {
      if (Date.now() - lastClick < 280) return;
      lastClick = Date.now();
      if (id === 'tablet-near') {
        const eye = camera.getWorldPosition(new THREE.Vector3());
        const orientation = camera.getWorldQuaternion(new THREE.Quaternion());
        board.position
          .copy(eye)
          .add(new THREE.Vector3(-0.28, -0.12, -0.45).applyQuaternion(orientation));
        board.scale.setScalar(0.78);
        board.lookAt(eye);
        return;
      }
      if (id === 'exit-vr') {
        void renderer.xr.getSession()?.end();
        return;
      }
      live.current.onAction(id);
    }
    function select(o: THREE.Object3D) {
      const kind = o.userData.kind;
      if (kind === 'button') {
        if (!o.userData.disabled) action(o.userData.id);
      } else if (kind === 'carton') live.current.onAction(`select:${o.userData.id}`);
      else if (kind === 'document') live.current.onAction('invoice');
    }
    function beginGrab(
      index: number,
      o: THREE.Object3D,
      origin: THREE.Vector3,
      distance: number,
      near: boolean,
      gesture: 'pinch' | 'grip',
    ) {
      const kind = o.userData.kind;
      const root = o.userData.root || o;
      if (held[index] || root.userData.held || root.userData.awaiting) return;
      if (root.userData.placed) {
        select(root);
        return;
      }
      if (kind === 'button') {
        select(o);
        return;
      }
      if (!['carton', 'document', 'tablet'].includes(kind)) return;
      root.userData.held = true;
      held[index] = {
        object: root,
        near,
        distance: Math.min(Math.max(distance, 0.25), 3.5),
        offset: root.position.clone().sub(origin),
        gesture,
        homePosition: root.position.clone(),
        homeQuaternion: root.quaternion.clone(),
      };
      if (kind === 'carton') select(root);
      else if (bright && kind === 'document') live.current.onAction('invoice');
    }
    function release(index: number, cancel = false) {
      const h = held[index];
      if (!h) return;
      held[index] = null;
      const o = h.object;
      o.userData.held = false;
      if (o.userData.kind !== 'carton') {
        if (cancel) {
          o.position.copy(h.homePosition);
          o.quaternion.copy(h.homeQuaternion);
        }
        return;
      }
      if (cancel) return;
      const zone = dropZone(o.position);
      if (!zone) {
        live.current.onNotice(
          'Release inside a labelled storage zone. The carton has returned to its last safe inspection position.',
        );
        return;
      }
      o.userData.awaiting = true;
      void live.current
        .onDrop(o.userData.id, zone)
        .then((correct) => {
          if (!correct) {
            const target = targets.get(o.userData.id);
            if (target) o.position.copy(target);
          }
        })
        .finally(() => {
          o.userData.awaiting = false;
        });
    }
    function rayFromMouse(e: PointerEvent | MouseEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
    }
    function onDown(e: PointerEvent) {
      if (renderer.xr.isPresenting) return;
      rayFromMouse(e);
      const h = ray.intersectObjects(
        [...objects.values(), ...(invoiceMesh ? [invoiceMesh] : [])],
        true,
      )[0];
      const o = h ? rootOf(h.object) : null;
      if (o?.userData.kind === 'document') {
        e.stopImmediatePropagation();
        live.current.onAction('invoice');
        return;
      }
      if (!o || !live.current.state.interactive) return;
      select(o);
      if (o.userData.placed || o.userData.awaiting) return;
      drag = { object: o, x: e.clientX, y: e.clientY, active: false };
      e.stopImmediatePropagation();
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (renderer.xr.isPresenting) return;
      rayFromMouse(e);
      if (drag) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.active = true;
        if (drag.active && ray.ray.intersectPlane(dragPlane, worldPoint)) {
          drag.object.position.copy(worldPoint);
          drag.object.userData.held = true;
          const zone = dropZone(worldPoint);
          renderer.domElement.dataset.dropZone = zone || '';
        }
        return;
      }
      const h = ray.intersectObjects([...objects.values()], true)[0];
      renderer.domElement.style.cursor = live.current.state.interactive && h ? 'grab' : 'default';
    }
    function onUp(e: PointerEvent) {
      if (!drag) return;
      const d = drag;
      drag = null;
      controls.enabled = true;
      d.object.userData.held = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId))
        renderer.domElement.releasePointerCapture(e.pointerId);
      if (!d.active) return;
      const zone = dropZone(d.object.position);
      if (zone) {
        d.object.userData.awaiting = true;
        void live.current
          .onDrop(d.object.userData.id, zone)
          .then((correct) => {
            if (!correct) {
              const target = targets.get(d.object.userData.id);
              if (target) d.object.position.copy(target);
            }
          })
          .finally(() => {
            d.object.userData.awaiting = false;
          });
      } else live.current.onNotice('Drop a carton inside a labelled shelf or quarantine zone.');
      renderer.domElement.dataset.dropZone = '';
    }
    function cancelPointer() {
      if (drag) {
        drag.object.userData.held = false;
        drag = null;
        controls.enabled = true;
      }
    }
    renderer.domElement.addEventListener('pointerdown', onDown, true);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', cancelPointer);
    const factory = new XRHandModelFactory();
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      rig.add(controller);
      controllers.push(controller);
      const laser = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 0, -3.5),
        ]),
        new THREE.LineBasicMaterial({ color: '#d0e8ac', transparent: true, opacity: 0.65 }),
      );
      controller.add(laser);
      controller.addEventListener('connected', (e) => {
        controller.userData.isHand = Boolean(e.data.hand);
        laser.visible = !e.data.hand;
      });
      controller.addEventListener('selectstart', () => {
        if (controller.userData.isHand) return;
        matrix.extractRotation(controller.matrixWorld);
        const origin = controller.getWorldPosition(new THREE.Vector3()),
          direction = new THREE.Vector3(0, 0, -1).applyMatrix4(matrix);
        const target = hit(origin, direction);
        if (target) {
          if (target.object.userData.kind === 'button') select(target.object);
          else beginGrab(i, target.object, origin, target.distance, false, 'pinch');
        }
      });
      controller.addEventListener('selectend', () => {
        if (!controller.userData.isHand) release(i);
      });
      const hand = renderer.xr.getHand(i);
      hand.add(factory.createHandModel(hand, 'boxes'));
      rig.add(hand);
      hands.push(hand);
      const handRay = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 0, -3),
        ]),
        new THREE.LineBasicMaterial({ color: '#c9e7a5', transparent: true, opacity: 0.65 }),
      );
      handRay.visible = false;
      scene.add(handRay);
      handRays.push(handRay);
    }
    function focusChanged() {
      const session = renderer.xr.getSession();
      if (session?.visibilityState !== 'visible') {
        for (let i = 0; i < 2; i++) release(i, true);
        cancelPointer();
        live.current.onFocusLoss();
      }
    }
    let activeSession: XRSession | null = null;
    let placeTabletOnFirstFrame = false;
    function xrStart() {
      placeTabletOnFirstFrame = true;
      activeSession = renderer.xr.getSession();
      activeSession?.addEventListener('visibilitychange', focusChanged);
      controls.enabled = false;
      renderer.shadowMap.enabled = false;
      sunlight.castShadow = false;
      rig.position.set(0, 0, 2.12);
      board.position.set(-0.65, 1.42, 0.98);
      board.rotation.y = 0.25;
      board.visible = true;
      taskPanel.visible = bright;
      board.scale.setScalar(1);
      const mr = runtime.current?.mode === 'immersive-ar';
      scene.background = mr ? null : new THREE.Color(bright ? '#EDF1F4' : '#e8ecdf');
      room.visible = !mr;
      live.current.onXRChange(true, mr ? 'Mixed reality' : 'VR');
    }
    function xrEnd() {
      activeSession?.removeEventListener('visibilitychange', focusChanged);
      activeSession = null;
      for (let i = 0; i < 2; i++) release(i, true);
      handRays.forEach((r) => (r.visible = false));
      rig.position.set(0, 0, 0);
      board.visible = false;
      taskPanel.visible = false;
      nearHint.visible = false;
      room.visible = true;
      inspectionPositions.clear();
      inspectionRotations.clear();
      updateItems(live.current.state);
      invoiceRoot.position.set(-1.12, 1.05, 0.5);
      invoiceRoot.rotation.set(-0.45, 0, 0);
      renderer.shadowMap.enabled = true;
      sunlight.castShadow = true;
      hadTracking = false;
      trackingPauseRequested = false;
      scene.background = new THREE.Color(bright ? '#EDF1F4' : '#e8ecdf');
      controls.enabled = true;
      reset();
      live.current.onXRChange(false);
    }
    renderer.xr.addEventListener('sessionstart', xrStart);
    renderer.xr.addEventListener('sessionend', xrEnd);
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width && height) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    observer.observe(host);
    let lastClock = '';
    let hadTracking = false,
      lastTracked = 0,
      trackingPauseRequested = false;
    const diagnostics = import.meta.env.DEV && new URLSearchParams(location.search).has('xrDebug');
    let lastDiagnostic = 0;
    renderer.setAnimationLoop(() => {
      const s = live.current.state;
      if (!s.interactive) {
        cancelPointer();
        held.forEach((h, i) => {
          if (h?.object.userData.kind === 'carton') release(i, true);
        });
      }
      held.forEach((h, i) => {
        if (h?.object.userData.placed) release(i, true);
      });
      if (!renderer.xr.isPresenting) controls.update();
      else {
        let trackedCount = 0;
        hands.forEach((hand, i) => {
          const index = hand.joints['index-finger-tip'],
            thumb = hand.joints['thumb-tip'],
            wrist = hand.joints.wrist;
          if (!hand.visible || !index?.visible || !thumb?.visible || !wrist?.visible) {
            handGestures[i].update(1, 1, false);
            handRays[i].visible = false;
            release(i, true);
            pokeLatch[i].clear();
            return;
          }
          trackedCount++;
          const tip = index.getWorldPosition(new THREE.Vector3()),
            thumbPos = thumb.getWorldPosition(new THREE.Vector3()),
            wristPos = wrist.getWorldPosition(new THREE.Vector3());
          const targetController = controllers[i];
          matrix.extractRotation(targetController.matrixWorld);
          const rayOrigin = targetController.visible
            ? targetController.getWorldPosition(new THREE.Vector3())
            : tip;
          const direction = targetController.visible
            ? new THREE.Vector3(0, 0, -1).applyMatrix4(matrix).normalize()
            : tip.clone().sub(wristPos).normalize();
          const curl =
            ['middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'].reduce((sum, name) => {
              const joint = hand.joints[name as XRHandJoint];
              return (
                sum +
                (joint ? joint.getWorldPosition(new THREE.Vector3()).distanceTo(wristPos) : 0.25)
              );
            }, 0) / 3;
          const g = handGestures[i].update(tip.distanceTo(thumbPos), curl);
          const palm = tip.clone().add(wristPos).multiplyScalar(0.5);
          handRays[i].visible = !held[i];
          handRays[i].position.copy(rayOrigin);
          handRays[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
          if (!held[i]) {
            let inContact = false;
            if (board.visible)
              for (const b of boardButtons) {
                const local = b.worldToLocal(tip.clone());
                const was = pokeLatch[i].has(b.userData.id);
                const inside = pokeInside(local, b.userData.width, b.userData.height, was);
                if (inside) {
                  inContact = true;
                  if (!was && pokeArmed[i] && !b.userData.disabled) {
                    pokeArmed[i] = false;
                    pokeLatch[i].add(b.userData.id);
                    select(b);
                  }
                }
                if (!inside) pokeLatch[i].delete(b.userData.id);
              }
            if (!inContact) pokeArmed[i] = true;
            if (g.pinchStart || g.grabStart) {
              const near = [...objects.values(), invoiceRoot, boardHandle]
                .filter(
                  (o) =>
                    !o.userData.placed &&
                    !o.userData.held &&
                    (o.userData.kind !== 'carton' || s.interactive),
                )
                .map((o) => ({
                  object: o,
                  distance: o.getWorldPosition(new THREE.Vector3()).distanceTo(palm),
                }))
                .sort((a, b) => a.distance - b.distance)[0];
              if (near?.distance < 0.19)
                beginGrab(
                  i,
                  near.object,
                  palm,
                  near.distance,
                  true,
                  g.grabStart ? 'grip' : 'pinch',
                );
              else if (g.pinchStart) {
                const target = hit(rayOrigin, direction);
                if (target) {
                  if (target.object.userData.kind === 'button') select(target.object);
                  else beginGrab(i, target.object, rayOrigin, target.distance, false, 'pinch');
                }
              }
            }
          }
          const h = held[i];
          if (h) {
            if ((h.gesture === 'pinch' && g.pinchEnd) || (h.gesture === 'grip' && g.grabEnd)) {
              release(i);
              return;
            }
            let destination = palm.clone().add(h.offset);
            if (!h.near) {
              ray.set(rayOrigin, direction);
              const surface = ray.ray.intersectPlane(dragPlane, new THREE.Vector3());
              destination =
                surface && surface.distanceTo(rayOrigin) < 6
                  ? surface
                  : rayOrigin.clone().add(direction.multiplyScalar(h.distance));
            }
            h.object.position.lerp(destination, 0.48);
            if (h.near)
              h.object.quaternion.slerp(wrist.getWorldQuaternion(new THREE.Quaternion()), 0.24);
          }
        });
        if (trackedCount) {
          hadTracking = true;
          lastTracked = Date.now();
          trackingPauseRequested = false;
        } else if (
          hadTracking &&
          s.interactive &&
          !trackingPauseRequested &&
          Date.now() - lastTracked > 1600 &&
          !Array.from(renderer.xr.getSession()?.inputSources || []).some((source) => !source.hand)
        ) {
          trackingPauseRequested = true;
          live.current.onFocusLoss();
          live.current.onNotice(
            'Hand tracking was lost. The shift is paused; resume explicitly when your hands are visible again.',
          );
        }
        controllers.forEach((controller, i) => {
          const h = held[i];
          if (h && !controller.userData.isHand) {
            matrix.extractRotation(controller.matrixWorld);
            const origin = controller.getWorldPosition(new THREE.Vector3());
            const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(matrix);
            h.object.position.lerp(origin.add(dir.multiplyScalar(h.distance)), 0.45);
          }
        });
      }
      for (const [id, o] of objects) {
        if (!o.userData.held && !o.userData.awaiting) {
          const target = targets.get(id);
          if (target) o.position.lerp(target, 0.15);
          o.quaternion.slerp(inspectionRotations.get(id) || new THREE.Quaternion(), 0.12);
        }
      }
      const selected = objects.get(s.selectedId || '');
      highlight.visible = Boolean(selected) && s.interactive && !selected?.userData.held;
      if (selected && highlight.visible) highlight.setFromObject(selected);
      nearHint.visible =
        bright && renderer.xr.isPresenting && highlight.visible && !selected?.userData.placed;
      if (nearHint.visible && selected) {
        nearHint.position.copy(selected.position).add(new THREE.Vector3(0, 0.23, 0));
        nearHint.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
      }
      if (clockMesh && lastClock !== s.view.clock) {
        lastClock = s.view.clock || '';
        const mat = clockMesh.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.map = texture(
          lastClock || 'OPS SIM  /  HANDS FIRST',
          boardBg,
          bright ? '#A9B4BF' : '#c6dcaa',
          768,
          65,
          28,
        );
        mat.needsUpdate = true;
      }
      if (Date.now() - lastSync > 1000) {
        updateItems(s);
        lastSync = Date.now();
      }
      if (diagnostics && Date.now() - lastDiagnostic > 100) {
        lastDiagnostic = Date.now();
        host.dataset.xrState = JSON.stringify({
          immersive: renderer.xr.isPresenting,
          roomVisible: room.visible,
          transparent: scene.background === null,
          buttons: [...boardButtons, ...(taskPanel.visible ? taskButtons : [])].map((b) => ({
            id: b.userData.id,
            label: b.userData.label,
            position: b.getWorldPosition(new THREE.Vector3()).toArray(),
            disabled: b.userData.disabled,
          })),
          objects: Object.fromEntries(
            [...objects].map(([id, o]) => [
              id,
              {
                position: o.position.toArray(),
                rotation: o.quaternion.toArray(),
                held: Boolean(o.userData.held),
              },
            ]),
          ),
          board: { position: board.position.toArray(), rotation: board.quaternion.toArray() },
          document: {
            position: invoiceRoot.position.toArray(),
            rotation: invoiceRoot.quaternion.toArray(),
            held: Boolean(invoiceRoot.userData.held),
          },
          calls: renderer.info.render.calls,
        });
      }
      renderer.render(scene, camera);
      if (renderer.xr.isPresenting && placeTabletOnFirstFrame) {
        placeTabletOnFirstFrame = false;
        const eye = camera.getWorldPosition(new THREE.Vector3());
        const yaw = new THREE.Euler().setFromQuaternion(
          camera.getWorldQuaternion(new THREE.Quaternion()),
          'YXZ',
        ).y;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        board.position.copy(eye).add(new THREE.Vector3(-0.65, -0.18, -1.14).applyQuaternion(q));
        board.quaternion
          .copy(q)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.25));
        if (bright) {
          positionPanels(s);
          lastComfort = JSON.stringify(s.comfort);
        }
      }
    });
    runtime.current = { renderer, sync, reset, bringCloser, mode: 'immersive-vr' };
    onReady(true);
    return () => {
      runtime.current = null;
      onReady(false);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      void renderer.xr.getSession()?.end();
      renderer.xr.removeEventListener('sessionstart', xrStart);
      renderer.xr.removeEventListener('sessionend', xrEnd);
      renderer.domElement.removeEventListener('pointerdown', onDown, true);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', cancelPointer);
      controls.dispose();
      disposeMesh(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="receiving-canvas-wrap">
      <div ref={hostRef} className="receiving-canvas" data-testid="receiving-scene" />
      {fallback && (
        <div className="receiving-fallback">
          <WarehouseArt />
          <p>
            3D is unavailable here. The carton inspector and destination controls below provide the
            full practice workflow.
          </p>
        </div>
      )}
      <div className="receiving-scene-label">
        <i />
        LIVE RECEIVING FLOOR
      </div>
      <div className="receiving-scene-hint">
        {state.interactive
          ? 'Click to inspect · Drag to a zone · Scroll to look closer'
          : 'A short shift. A skill that stays with you.'}
      </div>
    </div>
  );
});
