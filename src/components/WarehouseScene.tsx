import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { Maximize2, MousePointer2, Move3D } from 'lucide-react';
import type { Task } from '../types';
import { WarehouseArt } from './ui';

export interface WarehouseHandle {
  enterVR: () => Promise<void>;
  resetView: () => void;
}
interface Props {
  variant: string;
  task: Task | null;
  reference: { label: string; value: string }[];
  feedback?: { message: string; correct: boolean } | null;
  onSelect: (value: string) => void;
  onVRChange: (active: boolean) => void;
  onError: (message: string) => void;
}
interface SceneRuntime {
  renderer: THREE.WebGLRenderer;
  reset: () => void;
  updateBoard: (task: Task | null) => void;
  setFeedback: (text: string, correct: boolean) => void;
}

function labelTexture(
  text: string,
  {
    width = 512,
    height = 128,
    background = '#f5f4e9',
    color = '#273c30',
    fontSize = 34,
    align = 'center',
  }: {
    width?: number;
    height?: number;
    background?: string;
    color?: string;
    fontSize?: number;
    align?: CanvasTextAlign;
  } = {},
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = `600 ${fontSize}px Arial`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const max = width - 40;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > max && current) {
      lines.push(current);
      current = word;
    } else current = test;
  }
  if (current) lines.push(current);
  const lineHeight = fontSize * 1.25;
  lines
    .slice(0, 5)
    .forEach((line, i) =>
      ctx.fillText(
        line,
        align === 'left' ? 20 : width / 2,
        height / 2 + (i - (Math.min(lines.length, 5) - 1) / 2) * lineHeight,
      ),
    );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const WarehouseScene = forwardRef<WarehouseHandle, Props>(function WarehouseScene(
  { variant, task, reference, feedback, onSelect, onVRChange, onError },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtime = useRef<SceneRuntime | null>(null);
  const callbacks = useRef({ onSelect, onVRChange, onError });
  callbacks.current = { onSelect, onVRChange, onError };
  const taskRef = useRef(task);
  taskRef.current = task;
  const [unavailable, setUnavailable] = useState(false);
  const [hover, setHover] = useState('');
  useImperativeHandle(
    ref,
    () => ({
      async enterVR() {
        if (!runtime.current || !navigator.xr)
          throw new Error(
            'WebXR is not available here. Open this app over HTTPS in a compatible Quest browser.',
          );
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        await runtime.current.renderer.xr.setSession(session);
      },
      resetView() {
        runtime.current?.reset();
      },
    }),
    [],
  );
  useEffect(() => {
    runtime.current?.updateBoard(task);
  }, [task]);
  useEffect(() => {
    runtime.current?.setFeedback(
      feedback ? `${feedback.correct ? 'Correct.' : 'Try again.'} ${feedback.message}` : '',
      feedback?.correct || false,
    );
  }, [feedback]);
  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.xr.enabled = true;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e5e8de');
    scene.fog = new THREE.Fog('#e5e8de', 14, 27);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
    camera.position.set(5.3, 4.5, 6.2);
    const rig = new THREE.Group();
    rig.add(camera);
    scene.add(rig);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.6, -0.15);
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    const hemi = new THREE.HemisphereLight('#fffdf1', '#819181', 1.8);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff7db', 3);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    const selectable: THREE.Object3D[] = [];
    const world = new THREE.Group();
    scene.add(world);
    const materialCache = new Map<string, THREE.MeshStandardMaterial>();
    function mat(color: string) {
      if (!materialCache.has(color))
        materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
      return materialCache.get(color)!;
    }
    function box(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
      parent: THREE.Object3D = world,
    ) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
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
      w = 1,
      h = 0.24,
      bg = '#f6f4df',
      fg = '#314837',
      parent: THREE.Object3D = world,
    ) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: labelTexture(text, {
            background: bg,
            color: fg,
            height: Math.round((512 * h) / w),
            fontSize: 32,
          }),
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    }
    function select(object: THREE.Object3D, id: string, name: string) {
      object.userData = { ...object.userData, id, name };
      selectable.push(object);
      return object;
    }
    box(0, -0.1, 0, 6.1, 0.2, 5.2, '#c9d0bc');
    box(0, 1.4, -2.5, 6.1, 2.8, 0.12, '#d0d9c2');
    box(-3, 1.4, -0.4, 0.12, 2.8, 4.2, '#b9c8ae');
    for (let i = -2; i <= 2; i++) box(i, 0.005, 0.55, 0.5, 0.012, 0.04, '#d6b75e');
    sign('MAINLAND  /  OPERATIONS LAB', 0, 2.45, -2.42, 2.4, 0.2, '#d0d9c2', '#51694d');
    function carton(x: number, y: number, z: number, id = '', label = '', damaged = false) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      world.add(g);
      box(0, 0, 0, 0.43, 0.37, 0.4, damaged ? '#b69170' : '#cfae7d', g);
      box(0, 0.19, 0, 0.07, 0.008, 0.4, '#e4cf9d', g);
      if (label)
        sign(
          damaged ? 'DAMAGED' : label,
          0,
          0.02,
          0.205,
          0.32,
          0.115,
          damaged ? '#ae553d' : '#f6edd5',
          damaged ? '#ffffff' : '#43543b',
          g,
        );
      if (damaged) {
        const line = box(0.09, 0.08, 0.211, 0.025, 0.2, 0.004, '#774e36', g);
        line.rotation.z = 0.6;
      }
      if (id) select(g, id, label || id);
      return g;
    }
    function shelf(x: number, z: number, code: string) {
      const group = new THREE.Group();
      world.add(group);
      for (const dx of [-0.64, 0.64])
        for (const dz of [-0.28, 0.28])
          box(x + dx, 0.96, z + dz, 0.045, 1.92, 0.045, '#526c56', group);
      for (let level = 0; level < 3; level++) {
        const y = 0.12 + level * 0.57;
        const platform = box(x, y, z, 1.4, 0.055, 0.66, '#8b9e7c', group);
        if (level === 0)
          select(platform, code === 'A' ? 'shelf-a' : 'shelf-b', `Storage rack ${code}`);
        for (let k = -1; k <= 1; k++) {
          const id =
            code === 'A' && level === 1 && k === 0
              ? 'rice'
              : code === 'B' && level === 1 && k === -1
                ? 'milk'
                : code === 'B' && level === 1 && k === 1
                  ? 'oil'
                  : '';
          const label =
            id === 'rice'
              ? 'RCE-01'
              : id === 'milk'
                ? 'MLK-02'
                : id === 'oil'
                  ? 'OIL-03'
                  : `LOT ${level + 1}`;
          carton(x + k * 0.44, y + 0.215, z + 0.03, id, label);
        }
      }
      sign(`RACK ${code}`, x, 1.97, z + 0.31, 0.7, 0.19, '#466149', '#f2f2d7');
    }
    shelf(-1.85, -1.8, 'A');
    shelf(-0.15, -1.8, 'B');
    // Receiving pallet and a genuinely selectable damaged carton.
    box(-1.9, 0.06, 0.2, 1.05, 0.12, 0.83, '#9e8358');
    for (let i = -1; i <= 1; i++) box(-1.9 + i * 0.33, 0.13, 0.2, 0.22, 0.03, 0.85, '#bba076');
    carton(-2.12, 0.34, 0, '', 'NG-2047');
    carton(-1.65, 0.34, 0, '', 'NG-2047');
    carton(-2.12, 0.34, 0.44, 'good-carton', 'SEALED');
    carton(-1.65, 0.34, 0.44, 'damaged-carton', 'DAMAGED', true);
    sign('RECEIVING', -1.9, 0.035, 0.96, 1.1, 0.2, '#c9d0bc', '#59664c').rotation.x = -Math.PI / 2;
    // Quarantine uses a marked tray, separate from sellable stock.
    const quarantine = box(-1.98, 0.06, 1.67, 1.05, 0.1, 0.72, '#c98f57');
    select(quarantine, 'quarantine', 'Quarantine zone');
    sign('QUARANTINE', -1.98, 0.13, 1.67, 0.95, 0.19, '#c98f57', '#3d392b').rotation.x =
      -Math.PI / 2;
    // Packing bench.
    const desk = box(1.7, 0.85, -0.7, 1.75, 0.12, 0.82, '#b89d75');
    select(desk, 'dispatch', 'Packing & dispatch bench');
    for (const x of [1, 2.4])
      for (const z of [-0.99, -0.4]) box(x, 0.42, z, 0.07, 0.8, 0.07, '#55705b');
    sign('PACK & DISPATCH', 1.7, 0.73, -0.278, 1.3, 0.17, '#49664d', '#f5f2db');
    if (variant === 'cash') {
      box(1.6, 0.96, -0.65, 0.45, 0.1, 0.4, '#3d5346');
      const screen = box(1.6, 1.16, -0.79, 0.38, 0.3, 0.045, '#294035');
      screen.rotation.x = -0.18;
      sign('₦ 88,500', 1.6, 1.18, -0.76, 0.33, 0.16, '#c6dbac', '#294035');
    } else {
      carton(1.35, 1.08, -0.65, 'packed-order', 'ORD-1082');
      box(2.14, 0.94, -0.6, 0.34, 0.015, 0.26, '#f5efdc');
    }
    // Emergency exit, extinguisher and the safety-specific hazards.
    box(2, 1.1, -2.415, 0.77, 2.2, 0.025, '#66866b');
    sign('EXIT →', 2, 2.33, -2.38, 0.72, 0.22, '#3f7553', '#ffffff');
    box(2.65, 0.9, -2.34, 0.14, 0.35, 0.15, '#b7634d');
    sign('FIRE', 2.65, 1.3, -2.37, 0.28, 0.12, '#b7634d', '#ffffff');
    if (variant === 'safety') {
      carton(2, 0.2, -1.9, 'blocked-exit', 'BLOCKED');
      const spill = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 14),
        new THREE.MeshStandardMaterial({
          color: '#769eaa',
          roughness: 0.25,
          transparent: true,
          opacity: 0.85,
        }),
      );
      spill.rotation.x = -Math.PI / 2;
      spill.scale.y = 0.65;
      spill.position.set(1.5, 0.012, 0.45);
      world.add(spill);
      select(spill, 'spill', 'Liquid spill');
      carton(-1.85, 2.17, -1.8, 'heavy-carton', 'HEAVY');
    }
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const selectionBox = new THREE.BoxHelper(new THREE.Mesh(), '#c3e797');
    selectionBox.visible = false;
    scene.add(selectionBox);
    const board = new THREE.Group();
    board.visible = false;
    scene.add(board);
    const boardButtons: THREE.Object3D[] = [];
    let numeric = '';
    let boardTask: Task | null = taskRef.current;
    let boardFeedback = '';
    function disposeGroup(group: THREE.Group) {
      while (group.children.length) {
        const item = group.children[0] as THREE.Mesh;
        group.remove(item);
        item.geometry?.dispose();
        const materials = Array.isArray(item.material) ? item.material : [item.material];
        materials.forEach((m) => {
          if (!m) return;
          if ('map' in m) (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        });
      }
    }
    function updateBoard(t: Task | null) {
      if (t?.id !== boardTask?.id) {
        numeric = '';
        boardFeedback = '';
      }
      boardTask = t;
      disposeGroup(board);
      boardButtons.length = 0;
      const base = box(0, 0, 0, 1.22, 1.18, 0.035, '#263e31', board);
      base.castShadow = false;
      sign(
        t ? t.title : 'SESSION COMPLETE',
        0,
        0.48,
        0.025,
        1.12,
        0.12,
        '#263e31',
        '#e0efc6',
        board,
      );
      sign(
        t ? t.instruction : 'Well done! Your results are saved. Exit VR to view your report.',
        0,
        0.29,
        0.026,
        1.09,
        0.24,
        '#263e31',
        '#ffffff',
        board,
      );
      function vrButton(
        text: string,
        x: number,
        y: number,
        w: number,
        h: number,
        action: () => void,
        bg = '#e0e9cb',
      ) {
        const m = sign(text, x, y, 0.033, w, h, bg, '#263e31', board);
        m.userData = { action };
        boardButtons.push(m);
      }
      if (t?.type === 'number') {
        sign(
          `${numeric || 'Enter a number'} ${numeric ? t.unit || '' : ''}`,
          0,
          0.08,
          0.033,
          1.04,
          0.12,
          '#f4f3e7',
          '#263e31',
          board,
        );
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].forEach((key, i) =>
          vrButton(key, ((i % 3) - 1) * 0.34, -0.08 - Math.floor(i / 3) * 0.105, 0.31, 0.09, () => {
            if (key === 'OK') {
              if (numeric) callbacks.current.onSelect(numeric);
            } else {
              numeric = key === '⌫' ? numeric.slice(0, -1) : (numeric + key).slice(0, 9);
              updateBoard(boardTask);
            }
          }),
        );
      } else
        t?.options?.forEach((o, i) =>
          vrButton(o.label, 0, 0.06 - i * 0.145, 1.07, 0.125, () =>
            callbacks.current.onSelect(o.value),
          ),
        );
      if (boardFeedback)
        sign(boardFeedback, 0, -0.5, 0.035, 1.09, 0.13, '#263e31', '#e0efc6', board);
      if (!t) vrButton('Exit VR', 0, -0.1, 1, 0.15, () => void renderer.xr.getSession()?.end());
    }
    updateBoard(taskRef.current);
    const referenceBoard = new THREE.Group();
    referenceBoard.visible = false;
    referenceBoard.position.set(-1.05, 1.45, -0.45);
    referenceBoard.rotation.y = 0.4;
    scene.add(referenceBoard);
    box(0, 0, 0, 0.76, 0.92, 0.025, '#263e31', referenceBoard);
    sign('REFERENCE NOTE', 0, 0.36, 0.02, 0.68, 0.11, '#263e31', '#e0efc6', referenceBoard);
    reference.slice(0, 4).forEach((entry, i) => {
      sign(
        `${entry.label}: ${entry.value}`,
        0,
        0.18 - i * 0.16,
        0.022,
        0.68,
        0.14,
        '#263e31',
        '#ffffff',
        referenceBoard,
      );
    });
    function resolveObject(object: THREE.Object3D): THREE.Object3D | null {
      let obj: THREE.Object3D | null = object;
      while (obj && !obj.userData.id && !obj.userData.action) obj = obj.parent;
      return obj;
    }
    function activate(object: THREE.Object3D) {
      if (object.userData.action) object.userData.action();
      else if (object.userData.id && taskRef.current?.type === 'object')
        callbacks.current.onSelect(object.userData.id);
    }
    const onMove = (e: PointerEvent) => {
      if (renderer.xr.isPresenting) return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(selectable, true)[0];
      const obj = hit ? resolveObject(hit.object) : null;
      renderer.domElement.style.cursor = obj ? 'pointer' : 'grab';
      setHover(obj?.userData.name || '');
      selectionBox.visible = Boolean(obj);
      if (obj) selectionBox.setFromObject(obj);
    };
    let downX = 0,
      downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || renderer.xr.isPresenting) return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(selectable, true)[0];
      if (hit) {
        const obj = resolveObject(hit.object);
        if (obj) activate(obj);
      }
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('click', onClick);
    const handFactory = new XRHandModelFactory();
    const handPinched = [false, false];
    const xrHands: THREE.XRHandSpace[] = [];
    const tempMatrix = new THREE.Matrix4();
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      rig.add(controller);
      const laser = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 0, -3),
        ]),
        new THREE.LineBasicMaterial({ color: '#cce79b' }),
      );
      controller.add(laser);
      controller.addEventListener('select', () => {
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        origin.setFromMatrixPosition(controller.matrixWorld);
        direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        raycaster.set(origin, direction);
        const hit = raycaster.intersectObjects([...boardButtons, ...selectable], true)[0];
        if (hit) {
          const obj = resolveObject(hit.object);
          if (obj) activate(obj);
        }
      });
      const hand = renderer.xr.getHand(i);
      hand.add(handFactory.createHandModel(hand, 'boxes'));
      rig.add(hand);
      xrHands.push(hand);
    }
    function reset() {
      controls.target.set(0, 0.6, -0.15);
      camera.position.set(5.3, 4.5, 6.2);
      controls.update();
    }
    const onXRStart = () => {
      controls.enabled = false;
      rig.position.set(0, 0, 0.8);
      board.position.set(0, 1.4, -0.27);
      board.visible = true;
      referenceBoard.visible = true;
      selectionBox.visible = false;
      callbacks.current.onVRChange(true);
    };
    const onXREnd = () => {
      controls.enabled = true;
      rig.position.set(0, 0, 0);
      board.visible = false;
      referenceBoard.visible = false;
      reset();
      callbacks.current.onVRChange(false);
    };
    renderer.xr.addEventListener('sessionstart', onXRStart);
    renderer.xr.addEventListener('sessionend', onXREnd);
    const resize = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width && height) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    resize.observe(host);
    renderer.setAnimationLoop(() => {
      if (!renderer.xr.isPresenting) controls.update();
      else
        xrHands.forEach((hand, i) => {
          const index = hand.joints['index-finger-tip'];
          const thumb = hand.joints['thumb-tip'];
          const wrist = hand.joints.wrist;
          if (!index?.visible || !thumb?.visible || !wrist?.visible) {
            handPinched[i] = false;
            return;
          }
          const a = index.getWorldPosition(new THREE.Vector3());
          const b = thumb.getWorldPosition(new THREE.Vector3());
          const pinched = a.distanceTo(b) < 0.026;
          if (pinched && !handPinched[i]) {
            const w = wrist.getWorldPosition(new THREE.Vector3());
            direction.copy(a).sub(w).normalize();
            raycaster.set(a, direction);
            let hit = raycaster.intersectObjects([...boardButtons, ...selectable], true)[0];
            if (!hit) {
              const nearest = boardButtons
                .map((o) => ({ o, d: o.getWorldPosition(new THREE.Vector3()).distanceTo(a) }))
                .sort((p, q) => p.d - q.d)[0];
              if (nearest?.d < 0.15) activate(nearest.o);
            } else {
              const obj = resolveObject(hit.object);
              if (obj) activate(obj);
            }
          }
          handPinched[i] = pinched;
        });
      renderer.render(scene, camera);
    });
    runtime.current = {
      renderer,
      reset,
      updateBoard,
      setFeedback: (text) => {
        boardFeedback = text;
        updateBoard(boardTask);
      },
    };
    return () => {
      runtime.current = null;
      resize.disconnect();
      renderer.setAnimationLoop(null);
      void renderer.xr.getSession()?.end();
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.xr.removeEventListener('sessionstart', onXRStart);
      renderer.xr.removeEventListener('sessionend', onXREnd);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if ('map' in m) (m as THREE.MeshBasicMaterial).map?.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);
  return (
    <div className="warehouse-scene">
      <div ref={hostRef} className="three-host" data-testid="warehouse-canvas" />
      {unavailable && (
        <div className="webgl-fallback">
          <WarehouseArt variant={variant} />
          <p>
            3D is unavailable in this browser. All tasks still work with the controls on the right.
          </p>
        </div>
      )}
      <div className="scene-mode">
        <span className="live-dot" />
        INTERACTIVE STOCKROOM
      </div>
      <button
        className="scene-reset"
        onClick={() => runtime.current?.reset()}
        aria-label="Reset 3D view"
        title="Reset view"
      >
        <Maximize2 size={17} />
      </button>
      <div className="scene-hints">
        <span>
          <MousePointer2 size={13} />
          {hover || 'Click to inspect'}
        </span>
        <span>
          <Move3D size={13} />
          Drag to look around
        </span>
      </div>
    </div>
  );
});
