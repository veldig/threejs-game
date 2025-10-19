import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { randRange } from './utils.js';

export function createLights(scene){
  const ambient = new THREE.AmbientLight(0x88aaff, 0.4);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5,8,3);
  scene.add(ambient, dir);
}

export function createArena(scene, world){
  const geo = new THREE.CircleGeometry(30, 64);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0f2b5a, metalness: .1, roughness: .8 });
  const disk = new THREE.Mesh(geo, mat);
  disk.rotation.x = -Math.PI/2;
  disk.receiveShadow = true;
  scene.add(disk);

  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
  world.addBody(groundBody);
}

export function createPlayer(scene, world){
  const radius = 0.6;
  const geom = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6aa2ff, emissive: 0x0a1a4a, emissiveIntensity: 0.4 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  scene.add(mesh);

  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({ mass: 1, shape });
  body.linearDamping = 0.12;
  body.position.set(0, radius, 0);
  world.addBody(body);

  return { mesh, body, radius };
}

export function createOrb(scene, world, pos){
  const geom = new THREE.SphereGeometry(0.35, 20, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x35ff8a,
    emissive: 0x138a44,
    emissiveIntensity: 0.9
  });
  const mesh = new THREE.Mesh(geom, mat);
  // small visual lift so it never z-fights with the arena
  mesh.position.set(pos.x, pos.y + 0.1, pos.z);
  scene.add(mesh);

  // Physics body only for contact events; no physical push
  const shape = new CANNON.Sphere(0.35);
  const body = new CANNON.Body({
    mass: 0,                // static
    shape,
    collisionResponse: false
  });
  body.position.set(pos.x, pos.y, pos.z);
  world.addBody(body);

  return { mesh, body, kind: 'orb' };
}

export function createDebris(scene, world, pos){
  const geom = new THREE.DodecahedronGeometry(0.7);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff5555, metalness: .2, roughness: .7 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  scene.add(mesh);

  const shape = new CANNON.Sphere(0.7);
  const body = new CANNON.Body({ mass: 0.5, shape });
  body.position.set(pos.x, pos.y, pos.z);
  body.linearDamping = 0.02;
  // gentle drift
  body.velocity.set(randRange(-1,1), 0, randRange(-1,1));
  // NEW: add a bit of spin for visual interest
  body.angularVelocity.set(randRange(-1,1), randRange(-1,1), randRange(-1,1));
  body.angularDamping = 0.1;

  world.addBody(body);

  return { mesh, body, kind: 'debris' };
}
