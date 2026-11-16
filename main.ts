import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(name) {
  cpSync(join(projectRoot, name), join(destination, name), { recursive: true });
}

function prepareOutput() {
  mkdirSync(destination, { recursive: true });
  copyTree('app');

  const captures = join(destination, 'screenshots');
  mkdirSync(captures, { recursive: true });
  const suppliedCaptures = join(projectRoot, 'screenshots');
  if (existsSync(suppliedCaptures)) {
    cpSync(suppliedCaptures, captures, { recursive: true });
  }
}

function writeEntryRecord() {
  const limits = {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  };
  const dossierPath = join(destination, 'dossier.json');
  writeFileSync(dossierPath, buildDossier(destination, limits));
}

prepareOutput();
writeEntryRecord();
