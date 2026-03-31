#!/usr/bin/env node
/**
 * Script para actualizar version.json basado en package.json
 * Se ejecuta automáticamente después del build
 */

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, 'package.json');
const versionPath = path.join(__dirname, 'public', 'version.json');

try {
  // Leer package.json
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const version = packageJson.version;

  // Crear objeto de versión
  const versionData = {
    version: version,
    timestamp: Math.floor(Date.now() / 1000),
    notes: `Updated on ${new Date().toISOString()}`,
  };

  // Escribir version.json
  fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n', 'utf-8');
  console.log(`✅ version.json actualizado con versión ${version}`);
} catch (error) {
  console.error('❌ Error actualizando version.json:', error.message);
  process.exit(1);
}
