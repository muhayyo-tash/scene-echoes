import { createServer } from 'node:http';
import {
  loadDotenv,
  createJob,
  jobs,
  jobStatus,
  runConversion,
  runFilm,
  modelBytes,
  filmJson,
} from './live-reconstruct.mjs';

loadDotenv();
const port = Number(process.env.PORT ?? 8787);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method === 'POST' && url.pathname === '/v1/conversions') {
      const raw = await readBody(req);
      const input = raw.length ? JSON.parse(raw.toString('utf8')) : {};
      const job = createJob();
      void runConversion(job, input);
      send(202, { jobId: job.id });
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/v1/conversions/')) {
      const id = url.pathname.split('/').pop();
      const job = jobs.get(id);
      if (!job) return send(404, { error: 'missing' });
      send(200, jobStatus(job));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/films') {
      const raw = await readBody(req);
      const input = raw.length ? JSON.parse(raw.toString('utf8')) : {};
      const job = createJob();
      void runFilm(job, input);
      send(202, { jobId: job.id });
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/v1/films/')) {
      const id = url.pathname.split('/').pop();
      const job = jobs.get(id);
      if (!job) return send(404, { error: 'missing' });
      send(200, jobStatus(job));
      return;
    }
    if (url.pathname.startsWith('/films/') && url.pathname.endsWith('.json')) {
      const parts = url.pathname.split('/');
      const job = jobs.get(parts[2]);
      const body = job ? filmJson(job, parts[3]) : null;
      if (!body) return send(404, { error: 'missing' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
      return;
    }
    if (url.pathname.startsWith('/models/') && url.pathname.endsWith('.glb')) {
      const id = url.pathname.slice('/models/'.length, -'.glb'.length);
      const bytes = modelBytes(id);
      if (!bytes) return send(404, { error: 'missing' });
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
      res.end(bytes);
      return;
    }
    send(404, { error: 'not found' });
  } catch (error) {
    send(500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  console.log(`conversion server on http://localhost:${port} (Gemini key ${hasKey ? 'loaded' : 'missing'})`);
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
