// Pure gesture state machine. Hysteresis prevents a noisy hand pose becoming many clicks.
export class HandGesture {
  private pinched = false;
  private gripped = false;
  update(pinchDistance: number, curlDistance: number, tracked = true) {
    const wasPinched = this.pinched,
      wasGripped = this.gripped;
    if (!tracked) {
      this.pinched = false;
      this.gripped = false;
    } else {
      this.pinched = pinchDistance < (this.pinched ? 0.045 : 0.026);
      this.gripped = curlDistance < (this.gripped ? 0.15 : 0.115);
    }
    return {
      pinched: this.pinched,
      gripped: this.gripped,
      pinchStart: !wasPinched && this.pinched,
      pinchEnd: wasPinched && !this.pinched,
      grabStart: !wasGripped && this.gripped,
      grabEnd: wasGripped && !this.gripped,
    };
  }
}
export function pokeInside(
  local: { x: number; y: number; z: number },
  width: number,
  height: number,
  latched = false,
) {
  const inFace = Math.abs(local.x) < width / 2 && Math.abs(local.y) < height / 2;
  return inFace && local.z < (latched ? 0.055 : 0.018) && local.z > -0.055;
}
export const zones = {
  dry: {
    label: 'Dry stock rack',
    center: [-1.52, 0.9, -1.12],
    bounds: [-2.22, -0.82, -1.64, -0.68],
    color: '#8ca16f',
  },
  cold: {
    label: 'Cold storage',
    center: [1.52, 0.9, -1.12],
    bounds: [0.82, 2.22, -1.64, -0.68],
    color: '#7fadb8',
  },
  quarantine: {
    label: 'Quarantine / returns',
    center: [1.55, 0.85, 0.83],
    bounds: [0.9, 2.2, 0.35, 1.35],
    color: '#cda46f',
  },
} as const;
export function dropZone(point: { x: number; y: number; z: number }) {
  if (point.y < 0.35 || point.y > 2.1) return null;
  for (const [name, z] of Object.entries(zones)) {
    const [minX, maxX, minZ, maxZ] = z.bounds;
    if (point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ)
      return name as keyof typeof zones;
  }
  return null;
}
export function deliveryPosition(index: number): [number, number, number] {
  return [((index % 6) - 2.5) * 0.27, 0.94, Math.floor(index / 6) * 0.3 - 0.1];
}
export function stockPosition(zone: keyof typeof zones, index: number): [number, number, number] {
  if (zone === 'cold')
    return [
      1.37 + (index % 2) * 0.28,
      0.85 + Math.floor(index / 4) * 0.53,
      -1.25 + Math.floor((index % 4) / 2) * 0.29,
    ];
  if (zone === 'quarantine')
    return [1.2 + (index % 3) * 0.29, 0.94, 0.64 + Math.floor(index / 3) * 0.28];
  return [
    -1.82 + (index % 3) * 0.29,
    0.85 + Math.floor(index / 6) * 0.53,
    -1.25 + Math.floor((index % 6) / 3) * 0.29,
  ];
}
