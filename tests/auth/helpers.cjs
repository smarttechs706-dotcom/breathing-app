// Loads a TypeScript source file with its imports replaced by stubs, so these
// tests need only Node and the typescript package this repo already has.

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = path.join(__dirname, '..', '..');

function loadTs(relativePath, { stubs = {}, env = {} } = {}) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  // An unstubbed import is a test bug, so it fails instead of loading real code.
  const fakeRequire = (id) => {
    if (id in stubs) return stubs[id];
    throw new Error(`No stub for import: ${id}`);
  };

  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', outputText)(
    fakeRequire,
    module,
    module.exports,
    { env }
  );
  return module.exports;
}

module.exports = { loadTs };
