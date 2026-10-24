import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// One fingerprint shared by Vite and the test runner. Generated native renders
// must belong to this source build, not an earlier successful local invocation.
export function sourceFingerprint() {
  const files=[];
  function walk(dir) {
    for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
      const file=path.join(dir,entry.name);
      if(entry.isDirectory()) walk(file); else files.push(file);
    }
  }
  walk('src'); walk('cards');
  files.push('VERSION','vite.config.ts','package-lock.json','tests/react/fixtures.json',
    'scripts/build_react_package.py','scripts/mindmap_examples.py','scripts/test_build.mjs');
  const hash=crypto.createHash('sha256');
  for(const file of files.sort()) hash.update(file+'\0').update(fs.readFileSync(path.join(root,file)));
  return hash.digest('hex');
}
export function verifyTestBuild() {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'build/native-results.json')));
  if(manifest.sourceFingerprint!==sourceFingerprint())
    throw Error('Test fixtures are stale: run npm run build, then scripts/build_react_package.py with the official Anki backend.');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) verifyTestBuild();
