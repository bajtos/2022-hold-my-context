#!/usr/bin/env -S node -r dotenv/config

const Bluebird = require('bluebird');
const domain = require('domain');
const express = require('express');
const pg = require('pg');
const http = require('http');

function runWithLocalStorage(fn) {
  const d = domain.create();
  d.run(() => {
    d.add({});
    getLocalStorage().foo = 'bar';
    setImmediate(fn);
  });
}

function getLocalStorage() {
  return domain.active.members[0];
}

const PG_CONFIG = {
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
};

const Pool = require('pg-pool');
const bluebird = require('bluebird');
const pool = new Pool(PG_CONFIG);
pool.on('error', (err) => {
  console.log('[pg-pool]', err.message);
});
pool.on('connect', () => {
  console.log('[pg-pool] connect');
});

  const first = Bluebird.defer();
  const second = Bluebird.defer();
runWithLocalStorage(() => {

  Bluebird.resolve().then(() => {
    getLocalStorage().cid = 1;
  });
});


// const app = express();

// app.use(function initializeContext(req, res, next) {
//   runWithLocalStorage(() => {
//     // const d = domain.active;
//     // d.add(req);
//     // d.add(res);
//     setImmediate(next);
//     // process.nextTick(next);
//   });
// });

// let nextCid = 1;
// app.use(function initializeCorrelationId(req, res, next) {
//   getLocalStorage().cid = nextCid++;
//   console.log('received request', getLocalStorage().cid);
//   setImmediate(next);
//   // next();
// });

// let first = false;
// let second = false;
// let otherClient;

// app.use(function (req, res, next) {
//   Bluebird.delay(100).then(() => next());
// });

// app.use('/', function handleRoute(req, res, next) {
//   if (!first) {
//     first = true;
//     const i = setInterval(() => {
//       if (!second) return;
//       clearInterval(i);
//       run();
//     }, 10);
//   } else {
//     run();
//   }

//   function run() {
//     console.log('connecting (request id %s)', getLocalStorage().cid);
//     // pg.connect( `postgres://${PG_CONFIG.user}:${PG_CONFIG.password}@localhost/postgres`,
//     pool.connect((err, client, releaseClient) => {
//       if (err) return next(err);
//       if (!otherClient) otherClient = client;
//       else if (client !== otherClient) return next(new Error('pg client was NOT reused'));
//       else console.log('reusing the same pg client');

//       client.query('SELECT error', (err, result) => {
//         releaseClient();
//         second = true;
//         if (err) return next(err);

//         res.json(result.rows);
//       });
//     });
//   }
// });

// app.use(function notFound(req, res, next) {
//   next(new Error(`Not found: ${req.method} ${req.path}`));
// });

// app.use(function errorHandler(err, req, res, next) {
//   console.log('Cannot handle request %s:', getLocalStorage().cid, err.message);
//   res.json({ error: true });
// });

// app.listen(3000, () => {
//   makeRequest();
//   makeRequest();
//   /*
//   makeRequest(() => {
//     makeRequest(() => {
//       process.exit(0);
//     });
//   });
//   */
// });

// function makeRequest(cb) {
//   const req = http.request('http://localhost:3000/');
//   req.setHeader('Accepts', 'application/json');
//   req
//     .on('response', (res) => {
//       res.resume();
//       res.on('end', () => cb && cb());
//     })
//     .end();
// }
