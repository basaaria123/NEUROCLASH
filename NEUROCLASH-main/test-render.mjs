import * as THREE from 'three';

console.log('Testing THREE geometries...');

try {
  // Test geometries used in PlayerCharacter
  new THREE.CapsuleGeometry(0.13, 0.32, 6, 8);
  new THREE.BoxGeometry(0.06, 0.18, 0.14);
  new THREE.CylinderGeometry(0.115, 0.125, 0.06, 10);
  new THREE.CylinderGeometry(0.28, 0.25, 0.18, 12);
  new THREE.CylinderGeometry(0.31, 0.29, 0.46, 12, 1, false, Math.PI * 0.7, Math.PI * 1.6);
  new THREE.CircleGeometry(0.045, 3);
  new THREE.RingGeometry(0.082, 0.1, 3);
  new THREE.TorusGeometry(0.13, 0.025, 8, 24);
  new THREE.SphereGeometry(0.075, 8, 8);
  new THREE.SphereGeometry(0.26, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.72);
  new THREE.TorusGeometry(0.24, 0.032, 10, 24, Math.PI * 1.5);
  new THREE.ConeGeometry(0.05, 0.16, 4);

  // Test geometries used in AiCharacter
  new THREE.CylinderGeometry(0.08, 0.08, 0.22, 12);
  new THREE.TorusGeometry(0.275, 0.015, 6, 20);
  new THREE.RingGeometry(0.11, 0.13, 24);
  new THREE.RingGeometry(0.065, 0.085, 24);
  new THREE.CircleGeometry(0.038, 16);
  new THREE.TorusGeometry(0.155, 0.015, 6, 20);
  new THREE.ConeGeometry(0.035, 0.22, 4);
  console.log('All THREE geometries created successfully!');
} catch (err) {
  console.error('Error creating geometries:', err);
}
