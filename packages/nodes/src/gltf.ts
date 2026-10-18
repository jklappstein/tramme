// A lean glTF 2.0 reader: enough of the format for a node that draws a model
// with rigid animation (no skinning, no morph targets, no external textures).
// Pure: it turns a .glb (or a .gltf with an embedded buffer) into plain typed
// arrays, so the renderer's WebGL service can upload them once.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x, y, z, w

/** one drawable piece: a mesh primitive with its material colour */
export interface GltfPrim {
  positions: Float32Array;
  normals: Float32Array | null;
  indices: Uint32Array;
  color: [number, number, number, number];
}

/** one animation track: when the times say so, the property takes these values */
export interface GltfChannel {
  path: 'translation' | 'rotation' | 'scale';
  /** seconds, rising */
  times: Float32Array;
  /** xyz per key (translation, scale) or xyzw per key (rotation) */
  values: Float32Array;
  /** 3 floats per key before each value (CUBICSPLINE), else 0 */
  pre: number;
  /** 0 STEP, 1 LINEAR (slerp for rotations), 2 CUBICSPLINE */
  interp: 0 | 1 | 2;
}

export interface GltfNode {
  name: string;
  prims: GltfPrim[];
  children: GltfNode[];
  translation: Vec3;
  rotation: Quat;
  scale: Vec3;
  channels: GltfChannel[];
  /** of this node's own geometry, in its local space */
  center: Vec3;
  radius: number;
}

export interface GltfModel {
  roots: GltfNode[];
  /** of the whole model, in its own space */
  center: Vec3;
  radius: number;
  /** longest track, 0 when nothing animates */
  duration: number;
}

const COMPONENT = new Map<number, number>([[5120, 1], [5121, 1], [5122, 2], [5123, 2], [5125, 4], [5126, 4]]);
type Numbers = Float32Array | Uint32Array | Uint16Array | Uint8Array;
const ARRAY = new Map<number, new (buffer: ArrayBuffer, byteOffset: number, length: number) => Numbers>([[5121, Uint8Array], [5123, Uint16Array], [5125, Uint32Array], [5126, Float32Array]]);
const KIND = new Map<string, number>([['SCALAR', 1], ['VEC2', 2], ['VEC3', 3], ['VEC4', 4], ['MAT4', 16]]);

/** reads one accessor as a flat typed array (interleaved views are gathered) */
function readAccessor(gltf: any, bin: ArrayBuffer, index: number): Numbers {
  const a = gltf.accessors[index];
  const n = KIND.get(a.type);
  if (!n) throw new Error(`unsupported glTF accessor type ${a.type}`);
  const Ctor = ARRAY.get(a.componentType);
  const width = COMPONENT.get(a.componentType);
  if (!Ctor || !width) throw new Error(`unsupported glTF component type ${a.componentType}`);
  if (a.sparse) throw new Error('sparse glTF accessors are not supported');
  const v = gltf.bufferViews[a.bufferView ?? 0];
  const base = (v?.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = v?.byteStride ?? n * width;
  if (v?.buffer !== undefined && v.buffer !== 0) throw new Error('a .gltf with more than one buffer is not supported');
  const count = a.count * n;
  if (stride === n * width) return new Ctor(bin, base, count);
  const out = new (Ctor as unknown as new (n: number) => Numbers)(count);
  const view = new DataView(bin);
  const get = width === 4 ? (o: number) => view.getFloat32(o, true) : width === 2 ? (o: number) => view.getUint16(o, true) : (o: number) => view.getUint8(o);
  for (let i = 0; i < count; i++) out[i] = get(base + Math.floor(i / n) * stride + (i % n) * width);
  return out;
}

function colorOf(gltf: any, prim: any): [number, number, number, number] {
  const c = gltf.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorFactor;
  return (Array.isArray(c) && c.length === 4 ? c : [1, 1, 1, 1]) as [number, number, number, number];
}

/** geometry floats must be 32-bit; anything else is refused with a clear name */
function asFloat(a: Float32Array | Uint32Array | Uint16Array | Uint8Array, what: string): Float32Array {
  if (!(a instanceof Float32Array)) throw new Error(`the glTF accessor ${what} must hold 32-bit floats`);
  return a;
}

/** geometry of one mesh, without a node's transform */
function meshOf(gltf: any, bin: ArrayBuffer, meshIndex: number): { prims: GltfPrim[]; center: Vec3; radius: number } {
  const mesh = gltf.meshes[meshIndex];
  const prims: GltfPrim[] = [];
  let min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const prim of mesh.primitives) {
    if (prim.mode !== undefined && prim.mode !== 4) throw new Error('only glTF TRIANGLES meshes are drawn');
    if (prim.attributes.POSITION === undefined) throw new Error('a glTF primitive has no POSITION');
    const positions = asFloat(readAccessor(gltf, bin, prim.attributes.POSITION), 'POSITION');
    const normals = prim.attributes.NORMAL === undefined ? null : asFloat(readAccessor(gltf, bin, prim.attributes.NORMAL), 'NORMAL');
    const indices = Uint32Array.from(readAccessor(gltf, bin, prim.indices));
    prims.push({ positions, normals, indices, color: colorOf(gltf, prim) });
    for (let i = 0; i < positions.length; i += 3) for (let d = 0; d < 3; d++) {
      if (positions[i + d] < min[d]) min[d] = positions[i + d];
      if (positions[i + d] > max[d]) max[d] = positions[i + d];
    }
  }
  if (!prims.length) throw new Error('the glTF mesh has no triangle primitive');
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let radius = 0;
  for (const p of prims) {
    const q = p.positions;
    for (let i = 0; i < q.length; i += 3) {
      const d = Math.hypot(q[i] - center[0], q[i + 1] - center[1], q[i + 2] - center[2]);
      if (d > radius) radius = d;
    }
  }
  return { prims, center, radius: radius || 1 };
}

function nodeOf(gltf: any, bin: ArrayBuffer, index: number, duration: { n: number }): GltfNode {
  const n = gltf.nodes[index];
  const made: GltfNode = {
    name: n.name ?? `node ${index}`,
    prims: n.mesh === undefined ? [] : meshOf(gltf, bin, n.mesh).prims,
    children: (n.children ?? []).map((c: number) => nodeOf(gltf, bin, c, duration)),
    translation: n.translation ?? [0, 0, 0],
    rotation: n.rotation ?? [0, 0, 0, 1],
    scale: n.scale ?? [1, 1, 1],
    channels: [],
    center: n.mesh === undefined ? [0, 0, 0] : meshOf(gltf, bin, n.mesh).center,
    radius: n.mesh === undefined ? 0 : meshOf(gltf, bin, n.mesh).radius,
  };
  if (n.matrix) throw new Error('glTF node matrices are not supported (use translation, rotation, scale)');
  // its animation tracks
  for (const anim of gltf.animations ?? []) for (const ch of anim.channels) {
    if (ch.target.node !== index || ch.target.path === 'weights') continue;
    const s = anim.samplers[ch.sampler];
    const times = asFloat(readAccessor(gltf, bin, s.input), 'an animation input');
    const values = asFloat(readAccessor(gltf, bin, s.output), 'an animation output');
    const interp = s.interpolation === 'STEP' ? 0 : s.interpolation === 'CUBICSPLINE' ? 2 : 1;
    made.channels.push({ path: ch.target.path, times, values, pre: interp === 2 ? 3 : 0, interp });
    const end = times[times.length - 1] ?? 0;
    if (end > duration.n) duration.n = end;
  }
  return made;
}

/** a .gltf whose buffers are data URIs; external files are refused with a clear message */
function embeddedJsonBuffer(gltf: any): ArrayBuffer {
  const b = gltf.buffers?.[0];
  if (!b?.uri?.startsWith('data:')) throw new Error('a .gltf with a separate .bin file is not supported: use a .glb');
  const comma = b.uri.indexOf(',');
  const head = b.uri.slice(5, comma);
  const body = atob(b.uri.slice(comma + 1));
  const out = new Uint8Array(b.byteLength ?? body.length);
  if (!head.includes('base64')) throw new Error('the .gltf buffer must be base64');
  for (let i = 0; i < out.length; i++) out[i] = body.charCodeAt(i);
  return out.buffer;
}

/** parses a .glb (chunks) or an embedded .gltf into the model's plain arrays */
export function parseGltf(data: ArrayBuffer): GltfModel {
  let gltf: any, bin: ArrayBuffer;
  const head = new DataView(data);
  if (data.byteLength >= 12 && head.getUint32(0, true) === 0x46546c67) {
    // GLB: a JSON chunk then a binary chunk
    if (head.getUint32(4, true) !== 2) throw new Error('only glTF 2.0 files are read');
    let at = 12, json: string | null = null;
    bin = new ArrayBuffer(0);
    while (at + 8 <= data.byteLength) {
      const length = head.getUint32(at, true);
      const type = head.getUint32(at + 4, true);
      if (type === 0x4e4f534a) json = new TextDecoder().decode(new Uint8Array(data, at + 8, length)).replace(/[\0\s]+$/, '');
      else if (type === 0x004e4942) bin = data.slice(at + 8, at + 8 + length);
      at += 8 + length + ((4 - (length % 4)) % 4);
    }
    if (!json) throw new Error('the .glb file has no JSON chunk');
    gltf = JSON.parse(json);
  } else {
    gltf = JSON.parse(new TextDecoder().decode(data));
    bin = embeddedJsonBuffer(gltf);
  }
  if (!gltf.accessors || !gltf.meshes) throw new Error('not a glTF file with meshes');
  const duration = { n: 0 };
  const scene = gltf.scenes?.[gltf.scene ?? 0] ?? { nodes: gltf.nodes?.map((_: unknown, i: number) => i) ?? [] };
  const roots = (scene.nodes ?? []).map((i: number) => nodeOf(gltf, bin, i, duration));
  const bounds = { center: [0, 0, 0] as Vec3, radius: 0 };
  // the whole model's sphere: the roots' spheres are in local space, the roots are usually at the origin
  let min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const sweep = (n: GltfNode) => {
    for (let d = 0; d < 3; d++) {
      if (n.center[d] - n.radius < min[d]) min[d] = n.center[d] - n.radius;
      if (n.center[d] + n.radius > max[d]) max[d] = n.center[d] + n.radius;
    }
    n.children.forEach(sweep);
  };
  roots.forEach(sweep);
  for (let d = 0; d < 3; d++) bounds.center[d] = (min[d] + max[d]) / 2;
  bounds.radius = Math.max(1, ...[0, 1, 2].map((d) => max[d] - bounds.center[d]), ...[0, 1, 2].map((d) => min[d] - bounds.center[d]).map(Math.abs));
  return { roots, center: bounds.center, radius: bounds.radius, duration: duration.n };
}

/** a node's property at t, from its track (slerp for quaternions) */
export function sampleChannel(c: GltfChannel, t: number, out: Float32Array): void {
  const { times, values, pre, interp } = c;
  const stride = (c.path === 'rotation' ? 4 : 3) * (1 + pre);
  const n = times.length;
  if (!n || t <= times[0]) {
    const at = interp === 2 ? pre : 0;
    for (let d = 0; d < stride / (1 + pre); d++) out[d] = values[at + d];
    return;
  }
  if (t >= times[n - 1]) {
    const at = (n - 1) * stride + (interp === 2 ? pre : 0);
    for (let d = 0; d < stride / (1 + pre); d++) out[d] = values[at + d];
    return;
  }
  let i = 0;
  while (i < n - 2 && times[i + 1] <= t) i++;
  const span = times[i + 1] - times[i] || 1e-6;
  const f = (t - times[i]) / span;
  const width = stride / (1 + pre);
  const a = i * stride + (interp === 2 ? pre : 0), b = (i + 1) * stride + (interp === 2 ? pre : 0);
  if (interp === 0) { for (let d = 0; d < width; d++) out[d] = values[a + d]; return; }
  if (c.path === 'rotation') {
    // slerp, the shortest way round
    let dot = 0;
    for (let d = 0; d < 4; d++) dot += values[a + d] * values[b + d];
    const sign = dot < 0 ? -1 : 1;
    dot *= sign;
    if (dot > 0.9995) {
      for (let d = 0; d < 4; d++) out[d] = values[a + d] + f * (values[b + d] * sign - values[a + d]);
      const l = Math.hypot(out[0], out[1], out[2], out[3]);
      for (let d = 0; d < 4; d++) out[d] /= l;
      return;
    }
    const th = Math.acos(dot), s = Math.sin(th);
    const wa = Math.sin((1 - f) * th) / s, wb = Math.sin(f * th) / s;
    for (let d = 0; d < 4; d++) out[d] = values[a + d] * wa + values[b + d] * sign * wb;
    return;
  }
  for (let d = 0; d < width; d++) out[d] = values[a + d] + f * (values[b + d] - values[a + d]);
}
