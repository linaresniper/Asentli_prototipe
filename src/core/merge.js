import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Fusiona todas las mallas estáticas bajo `root` por material para reducir draw calls
// (importante en visores standalone como Meta Quest).
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const baked = [];

  root.traverse((o) => {
    if (!o.isMesh || o.userData.noBake || !o.visible) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = Array.isArray(o.material) && src.groups.length
      ? src.groups
      : [{ start: 0, count: src.attributes.position.count, materialIndex: 0 }];
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0];
      if (!mat) continue;
      const part = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const a = src.attributes[name];
        if (!a) continue;
        part.setAttribute(name, new THREE.BufferAttribute(
          a.array.slice(g.start * a.itemSize, (g.start + g.count) * a.itemSize), a.itemSize));
      }
      if (!part.attributes.uv) {
        part.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.count * 2), 2));
      }
      if (!part.attributes.normal) part.computeVertexNormals();
      part.applyMatrix4(m);
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(part);
    }
    baked.push(o);
  });

  for (const o of baked) o.parent.remove(o);
  for (const [mat, parts] of buckets) {
    const merged = mergeGeometries(parts, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
  }
  return root;
}

// Fusiona geometrías hijas que comparten material dentro de un grupo (p. ej. 12 huevos).
export function mergeChildrenByMaterial(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  group.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.userData.keep) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
    remove.push(o);
  });
  for (const [mat, list] of buckets) {
    if (list.length < 2) continue;
    const merged = mergeGeometries(list, false);
    if (!merged) continue;
    for (const o of remove) if (o.material === mat) o.parent.remove(o);
    group.add(new THREE.Mesh(merged, mat));
  }
  return group;
}
