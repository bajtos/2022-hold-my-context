#!/usr/bin/env -S node -r dotenv/config

const { AsyncLocalStorage } = require('async_hooks');
const express = require('express');
const pg = require('pg');
const http = require('http');

/**
 * @type {AsyncLocalStorage<Map<string, any>>}
 */
const asyncLocalStorage = new AsyncLocalStorage();
function getLocalStorage() {
  return asyncLocalStorage.getStore();
}

const PG_CONFIG = {
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
};

let pool = new pg.Pool(PG_CONFIG);

const app = express();

app.use(function initializeContext(req, res, next) {
  asyncLocalStorage.run(new Map(), function () {
    next();
  });
});

let nextCid = 1;
app.use(function initializeCorrelationId(req, res, next) {
  getLocalStorage().set('cid', nextCid++);
  console.log('received request', getLocalStorage().get('cid'));
  next();
});

let first = false;
let second = false;
let otherClient;

// Corrupted context - requests handled in parallel

app.use('/corrupted', function handleRoute(req, res, next) {
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

  function run() {
    console.log('connecting - request id', getLocalStorage().get('cid'));
    pool.connect((err, client, releaseClient) => {
      if (err) {
        console.log('Cannot connect to Postgres:', err);
        return next(err);
      }
      if (!otherClient) otherClient = client;
      else if (client !== otherClient) return next(new Error('pg client was NOT reused'));

      client.query('SELECT error', (err, result) => {
        releaseClient();
        second = true;
        if (err) return next(err);

        res.json(result.rows);
      });
    });
  }
});

// Lost context - requests made in series

app.use('/lost', function handleRoute(req, res, next) {
  console.log('connecting - request id', getLocalStorage().get('cid'));
  pool.connect((err, client, releaseClient) => {
    if (err) return next(err);
    if (!otherClient) otherClient = client;
    else if (client !== otherClient) return next(new Error('pg client was NOT reused'));

    client.query('SELECT error', (err, result) => {
      releaseClient();
      if (err) return next(err);

      res.json(result.rows);
    });
  });
});

app.use(function notFound(req, res, next) {
  next(new Error(`Not found: ${req.method} ${req.path}`));
});

app.use(function errorHandler(err, req, res, next) {
  console.log('Cannot handle request', getLocalStorage().get('cid'), err.message);
  res.json({ error: true });
});

app.listen(3000, () => {
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
