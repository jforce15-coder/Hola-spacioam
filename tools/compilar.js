/* Compila la app de huéspedes a UN archivo (build/app.js) con el mismo Babel y opciones que usaba el navegador
   (@babel/standalone 7.29 · presets react + env). El teléfono ya no descarga Babel (~3 MB) ni compila ~800 KB de JSX
   al abrir: la app arranca mucho más rápido. Orden: los .js simples primero (así corrían antes, porque Babel compila
   los text/babel al final) y después los .jsx en el orden de LISTA. Reescribe build/app.js?v=… en index.html. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Babel = require('@babel/standalone');
const raiz = path.join(__dirname, '..');
const LISTA = require('./lista.json');
let salida = '/* Generado por tools/compilar.js — no editar: se regenera solo. */\n';
for (const src of LISTA.simples) salida += '\n/* ' + src + ' */\n' + fs.readFileSync(path.join(raiz, src), 'utf8') + '\n;\n';
for (const src of LISTA.jsx) {
  const code = fs.readFileSync(path.join(raiz, src), 'utf8');
  const out = Babel.transform(code, { filename: src, presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread'], compact: true, comments: false, minified: true }).code;
  salida += '\n/* ' + src + ' */\n' + out + '\n;\n';
  console.log(src, Math.round(out.length / 1024) + ' KB');
}
fs.mkdirSync(path.join(raiz, 'build'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'build', 'app.js'), salida);
const v = crypto.createHash('sha1').update(salida).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(raiz, 'build', 'version.txt'), v + '\n');
const idx = path.join(raiz, 'index.html');
fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace(/build\/app\.js\?v=[A-Za-z0-9]*/g, 'build/app.js?v=' + v));
console.log('build/app.js', Math.round(salida.length / 1024) + ' KB · v=' + v);
