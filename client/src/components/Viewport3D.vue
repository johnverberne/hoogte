<script setup>
import { onMounted, onUnmounted, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildHeightField, radialOrigin } from "../lib/wave.js";

const props = defineProps({
  params: { type: Object, required: true },
});

let renderer;
let scene;
let camera;
let controls;
let mesh;
let markers = [];
let frame;
let host;
let resizeObserver;

function buildGeometry(params) {
  const n = params.resolution;
  const size = params.sizeMm;
  const base = params.baseThicknessMm;
  const field = buildHeightField(params);
  const cells = n - 1;
  const topCount = n * n;
  const positions = [];
  const indices = [];

  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1) - 0.5) * size;
      const y = (j / (n - 1) - 0.5) * size;
      positions.push(x, y, base + field[j * n + i]);
    }
  }
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1) - 0.5) * size;
      const y = (j / (n - 1) - 0.5) * size;
      positions.push(x, y, 0);
    }
  }

  const top = (i, j) => j * n + i;
  const bot = (i, j) => topCount + j * n + i;

  for (let j = 0; j < cells; j += 1) {
    for (let i = 0; i < cells; i += 1) {
      indices.push(top(i, j), top(i + 1, j), top(i + 1, j + 1));
      indices.push(top(i, j), top(i + 1, j + 1), top(i, j + 1));
      indices.push(bot(i, j), bot(i + 1, j + 1), bot(i + 1, j));
      indices.push(bot(i, j), bot(i, j + 1), bot(i + 1, j + 1));
    }
  }

  for (let i = 0; i < cells; i += 1) {
    addWall(indices, top, bot, i, 0, i + 1, 0);
    addWall(indices, top, bot, i + 1, cells, i, cells);
    addWall(indices, top, bot, 0, i + 1, 0, i);
    addWall(indices, top, bot, cells, i, cells, i + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addWall(indices, top, bot, i0, j0, i1, j1) {
  indices.push(bot(i0, j0), bot(i1, j1), top(i1, j1));
  indices.push(bot(i0, j0), top(i1, j1), top(i0, j0));
}

function rebuildMesh() {
  if (!scene) return;
  const geometry = buildGeometry(props.params);
  if (mesh) {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  } else {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xc4a882,
      roughness: 0.48,
      metalness: 0.04,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      sheen: 0.28,
      sheenColor: new THREE.Color(0xe4ddd0),
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  rebuildMarkers();
}

function clearMarkers() {
  for (const marker of markers) {
    scene.remove(marker);
    marker.geometry.dispose();
    marker.material.dispose();
  }
  markers = [];
}

function rebuildMarkers() {
  if (!scene) return;
  clearMarkers();
  if (props.params.mode !== "radial") return;

  const height = props.params.baseThicknessMm + props.params.waveHeightMm + 2.4;
  for (let i = 0; i < props.params.harmonicCount; i += 1) {
    const [x, y] = radialOrigin(props.params.harmonics[i], props.params);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xd25325,
        emissive: 0xb85c38,
        emissiveIntensity: 0.35,
        roughness: 0.4,
      })
    );
    marker.position.set(x, y, height);
    scene.add(marker);
    markers.push(marker);
  }
}

function fitCamera() {
  if (!camera || !controls) return;
  const size = props.params.sizeMm;
  const height = props.params.baseThicknessMm + props.params.waveHeightMm;
  const dist = size * 1.35;
  camera.position.set(dist * 0.72, -dist * 0.86, height + dist * 0.62);
  controls.target.set(0, 0, height * 0.35);
  controls.update();
}

function onResize() {
  if (!host || !renderer || !camera) return;
  const { clientWidth, clientHeight } = host;
  camera.aspect = clientWidth / Math.max(1, clientHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
}

function tick() {
  controls?.update();
  renderer?.render(scene, camera);
  frame = requestAnimationFrame(tick);
}

onMounted(() => {
  host = document.getElementById("viewport-host");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3efe6);

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  camera.up.set(0, 0, 1);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const hemi = new THREE.HemisphereLight(0xf7f3eb, 0x1a3a3a, 0.78);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e6, 1.18);
  key.position.set(80, -50, 140);
  key.castShadow = true;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x2a5554, 0.42);
  rim.position.set(-90, 70, 40);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(220, 64),
    new THREE.MeshStandardMaterial({ color: 0xe4ddd0, roughness: 1 })
  );
  ground.receiveShadow = true;
  ground.position.z = -0.2;
  scene.add(ground);

  rebuildMesh();
  fitCamera();
  onResize();
  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(host);
  tick();
});

watch(
  () => props.params,
  () => rebuildMesh(),
  { deep: true }
);

onUnmounted(() => {
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  controls?.dispose();
  clearMarkers();
  mesh?.geometry.dispose();
  mesh?.material.dispose();
  renderer?.dispose();
  renderer?.domElement.remove();
});
</script>

<template>
  <div id="viewport-host" class="viewport"></div>
</template>
