#!/usr/bin/env -S node -r dotenv/config

'use strict';

const Fastify = require('fastify');
const pg = require('pg');
const http = require('http');
const { fastifyRequestContextPlugin, requestContext } = require('@fastify/request-context');

function getLocalStorage() {
  return requestContext;
}

const PG_CONFIG = {
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
};

let pool = new pg.Pool(PG_CONFIG);

const app = Fastify();
app.register(fastifyRequestContextPlugin);

let nextCid = 1;
app.addHook('onRequest', async function initializeCorrelationId(req, reply) {
  getLocalStorage().set('cid', nextCid++);
  console.log('received request', requestContext.get('cid'));
});

let first = false;
let second = false;
let otherClient;

// Corrupted context - requests handled in parallel

app.get('/corrupted', function handleRoute1(req, reply) {
  return new Promise((resolve, reject) => {
    if (!first) {
      first = true;
      const i = setInterval(() => {
        if (!second) return;
        clearInterval(i);
        run();
      }, 100);
    } else {
      run();
    }

    async function run() {
      try {
        console.log('connecting - request id', getLocalStorage().get('cid'));
        const client = await pool.connect();
        if (!otherClient) otherClient = client;
        else if (client !== otherClient) throw new Error('pg client was NOT reused');

        try {
          const result = await client.query('SELECT error');
          resolve(result.rows);
        } finally {
          second = true;
          client.release();
        }
      } catch (err) {
        reject(err);
      }
    }
  });
});

// Lost context - requests made in series

app.get('/lost', async function handleRoute2(req, reply) {
  console.log('connecting - request id', getLocalStorage().get('cid'));
  const client = await pool.connect();
  if (!otherClient) otherClient = client;
  else if (client !== otherClient) throw new Error('pg client was NOT reused');

  try {
    const result = await client.query('SELECT error');
    reply.send(result.rows);
  } finally {
    client.release();
  }
});

app.setErrorHandler(function errorHandler(err, req, reply) {
  console.log(
    'Cannot handle request',
    getLocalStorage().get('cid'),
    err.routine === 'errorMissingColumn' ? err.message : err,
  );
  reply.send({ error: true });
});

app.listen(3000, (err) => {
  if (err) throw err;

  let done = 0;
  makeRequest('/corrupted', () => {
    if (++done === 2) next();
  });
  makeRequest('/corrupted', () => {
    if (++done === 2) next();
  });

  function next() {
    console.log('\n=== NEXT ROUND ===\n');
    otherClient = undefined;
    pool.end(() => {
      pool = new pg.Pool(PG_CONFIG);
      makeRequest('/lost', () => {
        makeRequest('/lost', () => {
          process.exit(0);
        });
      });
    });
  }
});

function makeRequest(endpoint, cb) {
  const req = http.request(`http://localhost:3000${endpoint}`);
  req.setHeader('Accepts', 'application/json');
  req
    .on('response', (res) => {
      res.resume();
      res.on('end', () => cb && cb());
    })
    .end();
}
