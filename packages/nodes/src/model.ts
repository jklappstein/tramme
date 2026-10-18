// A 3D model read from a .glb (glTF 2.0), drawn on the node's own WebGL2
// service (packages/render/src/gpu.ts): the file is parsed once at load, the
// meshes are uploaded once per context, and each frame animates the parts'
// translation, rotation and scale (rigid animation — skinned meshes draw at
// rest) and turns with the layer's time. The model is centred on the layer
// origin, framed square by `height` composition pixels; the camera sits far
// enough to hold the whole model whatever its shape.

import { type NodeType, type NodeGL } from '@tramme/core';
import { parseGltf, sampleChannel, type GltfModel, type GltfNode, type Quat } from './gltf.ts';

// ── a small mat4 kit (column-major, like WebGL) ──────────────

type Mat4 = Float32Array;

const M = (): Mat4 => new Float32Array(16);
const ident = (m: Mat4): Mat4 => { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; };
const mul = (out: Mat4, a: Mat4, b: Mat4): Mat4 => {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
};
const trs = (out: Mat4, t: ArrayLike<number>, q: Quat, s: ArrayLike<number>): Mat4 => {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  out[0] = (1 - (yy + zz)) * s[0]; out[1] = (xy + wz) * s[0]; out[2] = (xz - wy) * s[0]; out[3] = 0;
  out[4] = (xy - wz) * s[1]; out[5] = (1 - (xx + zz)) * s[1]; out[6] = (yz + wx) * s[1]; out[7] = 0;
  out[8] = (xz + wy) * s[2]; out[9] = (yz - wx) * s[2]; out[10] = (1 - (xx + yy)) * s[2]; out[11] = 0;
  out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
  return out;
};
const turnY = (out: Mat4, a: number): Mat4 => { ident(out); const c = Math.cos(a), s = Math.sin(a); out[0] = c; out[2] = -s; out[8] = s; out[10] = c; return out; };
const turnX = (out: Mat4, a: number): Mat4 => { ident(out); const c = Math.cos(a), s = Math.sin(a); out[5] = c; out[6] = s; out[9] = -s; out[10] = c; return out; };
const project = (out: Mat4, fovY: number, aspect: number, near: number, far: number): Mat4 => {
  const f = 1 / Math.tan(fovY / 2), k = 1 / (near - far);
  out.fill(0); out[0] = f / aspect; out[5] = f; out[10] = (far + near) * k; out[11] = -1; out[14] = 2 * far * near * k;
  return out;
};
const lookAt = (out: Mat4, eye: number[], at: number[]): Mat4 => {
  let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
  const zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  let xx = zz, xz = -zx; const xy = 0; // up (0,1,0) × z
  const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
};

// ── the parsed files and their uploads ───────────────────────

/** parsed files, keyed by asset id (a file's content is deterministic) */
const models = new Map<string, GltfModel>();
/** uploaded meshes, keyed by asset id; made again when the context is new */
interface Uploads { gl: WebGL2RenderingContext; prims: { vao: WebGLVertexArrayObject; count: number; color: number[] }[] }
const uploads = new Map<string, Uploads>();

const FOV = 35 * Math.PI / 180;
const D2R = Math.PI / 180;

const VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
uniform mat4 uProj, uView, uModel;
out vec3 vN;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vN = mat3(uModel) * aNormal;
  gl_Position = uProj * uView * w;
}`;
const FRAG = `#version 300 es
precision highp float;
in vec3 vN;
uniform vec4 uColor;
uniform int uLight;
out vec4 fragColor;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 base = uColor.rgb;
  float a = uColor.a;
  if (uLight == 2) { fragColor = vec4(base * a, a); return; } // flat
  float lit = 0.16; // a floor of ambient
  lit += 0.85 * max(dot(n, normalize(vec3(-0.5, 0.85, 0.55))), 0.0); // the key
  lit += 0.34 * max(dot(n, normalize(vec3(0.35, 0.45, 1.0))), 0.0); // the fill, towards the eye
  if (uLight == 0) lit += 0.35 * max(dot(n, normalize(vec3(0.8, 0.15, -0.5))), 0.0); // a studio rim
  fragColor = vec4(base * min(lit, 1.35) * a, a);
}`;

const T = new Float32Array(3), Q = new Float32Array(4), S = new Float32Array(3);

/** the node's local matrix at ta, its animation tracks applied */
function localOf(n: GltfNode, ta: number, out: Mat4): Mat4 {
  T.set(n.translation); Q.set(n.rotation); S.set(n.scale);
  for (const c of n.channels) sampleChannel(c, ta, c.path === 'rotation' ? Q : c.path === 'scale' ? S : T);
  return trs(out, T, [Q[0], Q[1], Q[2], Q[3]], S);
}

export const model: NodeType = {
  type: 'model.3d',
  title: '3D model',
  category: 'Media',
  description: 'A .glb model (glTF 2.0) drawn in 3D: its parts animate rigidly, it may spin slowly, its materials show by their base colour. Skinned meshes draw at rest.',
  props: {
    source: { type: 'asset', default: null, nullable: true, assetType: 'model', animatable: false, label: 'Model' },
    height: { type: 'number', default: 400, min: 8, max: 4096, step: 1, unit: 'px', label: 'Height', description: 'the square frame the model is drawn in' },
    spin: { type: 'number', default: 0, min: -360, max: 360, step: 1, unit: 'deg', label: 'Spin', description: 'a turntable spin, degrees per second, from the layer’s start' },
    yaw: { type: 'number', default: 0, min: -180, max: 180, step: 1, unit: 'deg', label: 'Yaw' },
    pitch: { type: 'number', default: 0, min: -89, max: 89, step: 1, unit: 'deg', label: 'Pitch' },
    explode: { type: 'number', default: 0, min: 0, max: 1, step: 0.01, label: 'Explode', description: 'the parts drift away from the centre' },
    light: { type: 'enum', default: 'studio', options: ['studio', 'sun', 'flat'], animatable: false, label: 'Light' },
  },
  async load(p, host) {
    if (!p.source) return;
    if (models.has(p.source)) return;
    const url = host.asset<string>(p.source);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`the model file could not be read (HTTP ${res.status})`);
    models.set(p.source, parseGltf(await res.arrayBuffer()));
  },
  bounds(p) {
    const h = Math.max(8, p.height ?? 400);
    return { x: -h / 2, y: -h / 2, w: h, h };
  },
  render: {
    gl(g: NodeGL, p: any, host) {
      const m = p.source ? models.get(p.source) : null;
      if (!m) throw new Error('the model file is not loaded yet');
      const { gl } = g;
      gl.viewport(0, 0, g.canvas.width, g.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const prog = g.program(FRAG, VERT);
      gl.useProgram(prog);
      let up = uploads.get(p.source);
      if (!up || up.gl !== gl) { up = { gl, prims: [] }; upload(m.roots, gl, up); uploads.set(p.source, up); }
      const aspect = g.canvas.width / g.canvas.height;
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uProj'), false, project(M(), FOV, aspect, m.radius / 32, m.radius * 8));
      const dist = m.radius / Math.sin(FOV / 2) * 1.06;
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uView'), false, lookAt(M(), [m.center[0], m.center[1], m.center[2] + dist], [m.center[0], m.center[1], m.center[2]]));
      gl.uniform1i(gl.getUniformLocation(prog, 'uLight'), p.light === 'sun' ? 1 : p.light === 'flat' ? 2 : 0);
      const uModel = gl.getUniformLocation(prog, 'uModel'), uColor = gl.getUniformLocation(prog, 'uColor');
      const ta = host.t - (host.layerIn ?? 0);
      const at = m.duration > 0 ? ta - Math.floor(ta / m.duration) * m.duration : 0;
      const turn = mul(M(), turnY(M(), ((p.yaw ?? 0) + (p.spin ?? 0) * ta) * D2R), turnX(M(), (p.pitch ?? 0) * D2R));
      const explode = p.explode ?? 0;
      let i = 0;
      const walk = (n: GltfNode, parent: Mat4) => {
        const world = mul(M(), parent, localOf(n, at, M()));
        for (const prim of n.prims) {
          const d = up!.prims[i++];
          let local = world;
          if (explode > 0) {
            const dx = n.center[0] - m.center[0], dy = n.center[1] - m.center[1], dz = n.center[2] - m.center[2];
            const l = Math.hypot(dx, dy, dz) || 1;
            const apart = ident(M()); apart[12] = (dx / l) * explode * m.radius * 1.5; apart[13] = (dy / l) * explode * m.radius * 1.5; apart[14] = (dz / l) * explode * m.radius * 1.5;
            local = mul(M(), world, apart);
          }
          gl.uniformMatrix4fv(uModel, false, mul(M(), turn, local));
          gl.uniform4fv(uColor, d.color);
          gl.bindVertexArray(d.vao);
          gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
        }
        n.children.forEach((c) => walk(c, world));
      };
      walk({ name: '§root', prims: [], children: m.roots, translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1], channels: [], center: m.center, radius: m.radius }, ident(M()));
      gl.bindVertexArray(null);
    },
  },
};

/** one buffer per primitive, attribute 0 the positions, 1 the normals (or up) */
function upload(roots: GltfNode[], gl: WebGL2RenderingContext, up: Uploads) {
  const walk = (n: GltfNode) => {
    for (const prim of n.prims) {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()!);
      gl.bufferData(gl.ARRAY_BUFFER, prim.positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      if (prim.normals) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()!);
        gl.bufferData(gl.ARRAY_BUFFER, prim.normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(1);
        gl.vertexAttrib3f(1, 0, 1, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()!);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, prim.indices, gl.STATIC_DRAW);
      up.prims.push({ vao, count: prim.indices.length, color: prim.color });
    }
    n.children.forEach(walk);
  };
  roots.forEach(walk);
}
