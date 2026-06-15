const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mapDist = path.join(root, 'external', 'your-map-source', 'dist');
const mapDistAssets = path.join(mapDist, 'assets');
const publicAssets = path.join(root, 'public', 'assets');
const publicMapHtml = path.join(root, 'public', 'map', 'index.html');

function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

mustExist(mapDistAssets, 'Map dist assets directory');
mustExist(publicMapHtml, 'Public map HTML');

fs.mkdirSync(publicAssets, { recursive: true });

for (const fileName of fs.readdirSync(publicAssets)) {
  if (/^index-[\w-]+\.(js|css)$/.test(fileName)) {
    fs.rmSync(path.join(publicAssets, fileName), { force: true });
  }
}

const builtFiles = fs.readdirSync(mapDistAssets);
const jsFile = builtFiles.find((fileName) => /^index-[\w-]+\.js$/.test(fileName));
const cssFile = builtFiles.find((fileName) => /^index-[\w-]+\.css$/.test(fileName));

if (!jsFile || !cssFile) {
  throw new Error(`Map build did not produce expected index JS/CSS files in ${mapDistAssets}`);
}

for (const fileName of [jsFile, cssFile]) {
  fs.copyFileSync(path.join(mapDistAssets, fileName), path.join(publicAssets, fileName));
}

let html = fs.readFileSync(publicMapHtml, 'utf8');
html = html.replace(
  /<script type="module" crossorigin src="\.\.\/assets\/index-[\w-]+\.js"><\/script>/,
  `<script type="module" crossorigin src="../assets/${jsFile}"></script>`
);
html = html.replace(
  /<link rel="stylesheet" crossorigin href="\.\.\/assets\/index-[\w-]+\.css">/,
  `<link rel="stylesheet" crossorigin href="../assets/${cssFile}">`
);

if (!html.includes(jsFile) || !html.includes(cssFile)) {
  throw new Error('Failed to update public/map/index.html with fresh map asset names');
}

fs.writeFileSync(publicMapHtml, html);

console.log(`Synced map build: ${jsFile}, ${cssFile}`);
