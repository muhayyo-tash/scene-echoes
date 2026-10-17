import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 8787);
const jobs = new Map();
let seq = 1;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/conversions') {
    const id = `job-${seq++}`;
    jobs.set(id, { kind: 'model', created: Date.now() });
    json(res, 202, { jobId: id });
    return;
  }
  if (req.method === 'GET' && url.pathname.startsWith('/v1/conversions/')) {
    const id = url.pathname.split('/').pop();
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: 'missing' });
    const progress = Math.min(1, (Date.now() - job.created) / 1500);
    json(res, 200, {
      status: progress >= 1 ? 'done' : 'processing',
      progress,
      modelUrl: progress >= 1 ? '/models/sofa.glb' : undefined,
      realSize: 2,
      up: 'y',
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/films') {
    const id = `film-${seq++}`;
    jobs.set(id, { kind: 'film', created: Date.now() });
    json(res, 202, { jobId: id });
    return;
  }
  if (req.method === 'GET' && url.pathname.startsWith('/v1/films/')) {
    const id = url.pathname.split('/').pop();
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: 'missing' });
    const progress = Math.min(1, (Date.now() - job.created) / 1500);
    json(res, 200, {
      status: progress >= 1 ? 'done' : 'processing',
      progress,
      timelineUrl: progress >= 1 ? '/timeline.json' : undefined,
      manifestUrl: progress >= 1 ? '/manifest.json' : undefined,
    });
    return;
  }
  if (url.pathname === '/models/sofa.glb') {
    const path = join(root, 'public/assets/models/sofa.glb');
    const body = existsSync(path) ? readFileSync(path) : Buffer.from('glTF');
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
    res.end(body);
    return;
  }
  if (url.pathname === '/timeline.json') {
    json(res, 200, JSON.parse(readFileSync(join(root, 'public/assets/movie/timeline.json'), 'utf8')));
    return;
  }
  if (url.pathname === '/manifest.json') {
    json(res, 200, JSON.parse(readFileSync(join(root, 'public/assets/manifest.json'), 'utf8')));
    return;
  }
  json(res, 404, { error: 'not found' });
});

server.listen(port, () => {
  console.log(`mock conversion server on http://localhost:${port}`);
});

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}
