const q = require('q');
const Bluebird = require('bluebird');

const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

function resolve(value) {
  return q(value);
  // return Bluebird.resolve(value);
  // return Promise.resolve(value)
}

resolve('start')
.then(() => {
  asyncLocalStorage.run(1, () => {
    console.log('line 1 context', asyncLocalStorage.getStore());
    resolve('first').then(() => {
      console.log('line 1 context in then', asyncLocalStorage.getStore());
    });
  });
})
.then(() => {
  asyncLocalStorage.run(2, () => {
    console.log('line 2 context', asyncLocalStorage.getStore());
    resolve('first').then(() => {
      console.log('line 2 context in then', asyncLocalStorage.getStore());
    });
  });
})

