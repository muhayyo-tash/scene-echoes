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
import { writeFilmsIndex } from './list-films.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function sendJson(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function conversionDevPlugin() {
  loadDotenv();
  return {
    name: 'scene-echoes-conversion',
    buildStart() {
      writeFilmsIndex();
    },
    configureServer(server) {
      writeFilmsIndex();
      server.watcher.add('public/assets/movie');
      server.watcher.on('all', (_event, file) => {
        if (String(file).toLowerCase().endsWith('.mp4') && String(file).includes('assets/movie')) {
          writeFilmsIndex();
        }
      });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname;
        if (
          req.method === 'OPTIONS' &&
          (path.startsWith('/v1/') || path.startsWith('/models/') || path.startsWith('/films/'))
        ) {
          cors(res);
          res.statusCode = 204;
          res.end();
          return;
        }
        try {
          if (req.method === 'POST' && path === '/v1/conversions') {
            const raw = await readBody(req);
            const input = raw.length ? JSON.parse(raw.toString('utf8')) : {};
            const job = createJob();
            void runConversion(job, input);
            sendJson(res, 202, { jobId: job.id });
            return;
          }
          if (req.method === 'GET' && path.startsWith('/v1/conversions/')) {
            const id = path.split('/').pop();
            const job = jobs.get(id);
            if (!job) {
              sendJson(res, 404, { error: 'missing' });
              return;
            }
            sendJson(res, 200, jobStatus(job));
            return;
          }
          if (req.method === 'POST' && path === '/v1/films') {
            const raw = await readBody(req);
            const input = raw.length ? JSON.parse(raw.toString('utf8')) : {};
            const job = createJob();
            void runFilm(job, input);
            sendJson(res, 202, { jobId: job.id });
            return;
          }
          if (req.method === 'GET' && path.startsWith('/v1/films/')) {
            const id = path.split('/').pop();
            const job = jobs.get(id);
            if (!job) {
              sendJson(res, 404, { error: 'missing' });
              return;
            }
            sendJson(res, 200, jobStatus(job));
            return;
          }
          if (req.method === 'GET' && path.startsWith('/films/') && path.endsWith('.json')) {
            const parts = path.split('/');
            const id = parts[2];
            const name = parts[3];
            const job = jobs.get(id);
            const body = job ? filmJson(job, name) : null;
            if (!body) {
              sendJson(res, 404, { error: 'missing' });
              return;
            }
            cors(res);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
            return;
          }
          if (req.method === 'GET' && path.startsWith('/models/') && path.endsWith('.glb')) {
            const id = path.slice('/models/'.length, -'.glb'.length);
            const bytes = modelBytes(id);
            if (!bytes) {
              sendJson(res, 404, { error: 'missing' });
              return;
            }
            cors(res);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'model/gltf-binary');
            res.end(bytes);
            return;
          }
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
          return;
        }
        next();
      });
    },
  };
}
