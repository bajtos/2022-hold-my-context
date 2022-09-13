#!/usr/bin/env -S node -r dotenv/config

const { AsyncLocalStorage } = require('async_hooks');
const express = require('express');
const Bluebird = require('bluebird');
const q = require('q');
const http = require('http');

function promise() {
  // return Bluebird.resolve('resolved');
  return Promise.resolve();
}

/**
 * @type {AsyncLocalStorage<Map<string, any>>}
 */
const asyncLocalStorage = new AsyncLocalStorage();
function getLocalStorage() {
  return asyncLocalStorage.getStore();
}

const app = express();

app.use(function someAsyncPreprocessing(req, res, next) {
  // promise()
  q()
    .then(() => next())
});

app.use(function initializeContext(req, res, next) {
  asyncLocalStorage.run(new Map(), function () {
    next();
  });
});

let nextCid = 1;
app.use(function initializeCorrelationId(req, res, next) {
  getLocalStorage().set('cid', nextCid++);
  console.log('received request', getLocalStorage()?.get('cid'));
  next();
});

let first = false;
let second = false;

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
    console.log('start - request id', getLocalStorage()?.get('cid'));
    promise().then(() => {
      second = true;
      next(new Error('expected error'));
    });
  }
});

// Lost context - requests made in series

app.use('/lost', function handleRoute(req, res, next) {
  console.log('start - request id', getLocalStorage()?.get('cid'));
  promise().then(() => {
    next(new Error('expected error'));
  });
});

app.use(function notFound(req, res, next) {
  next(new Error(`Not found: ${req.method} ${req.path}`));
});

app.use(function errorHandler(err, req, res, next) {
  console.log('Cannot handle request', getLocalStorage()?.get('cid'), err.message);
  res.json({ error: true });
});

app.listen(3000, () => {
  let done = 0;
  makeRequest('/corrupted', () => {
    console.log('req 1 done');
    if (++done === 2) next();
  });
  makeRequest('/corrupted', () => {
    console.log('req 2 done');
    if (++done === 2) next();
  });

  function next() {
    console.log('\n=== NEXT ROUND ===\n');
    makeRequest('/lost', () => {
      makeRequest('/lost', () => {
        process.exit(0);
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
