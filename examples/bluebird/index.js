const { AsyncLocalStorage } = require('async_hooks');
//const Bluebird = require('bluebird');
const q = require('q');
const asyncLocalStorage = new AsyncLocalStorage();

asyncLocalStorage.run(1, function() {
  setImmediate(() => {
    console.log('initial context', asyncLocalStorage.getStore());
    q('resolved').then(() => {
      console.log('then', asyncLocalStorage.getStore());
      console.log('domain', process.domain);
    });
    console.log('tick');
  });
});
