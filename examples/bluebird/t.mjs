import Bluebird from 'bluebird';

function legacy() {
  return Bluebird.resolve('hello');
}

async function modern() {
  // set
  const p = legacy();
  console.log('Legacy promise:', getPromiseType(p));
  const value = await p;
  console.log('value', value);
  return value;
}

const p = modern();
console.log('Modern promise:', getPromiseType(p))
const value = await p;
console.log('value', value);

function getPromiseType(p) {
  return p instanceof Bluebird
    ? 'Bluebird'
    : p instanceof Promise
      ? 'Native'
      : 'unknown'
}
