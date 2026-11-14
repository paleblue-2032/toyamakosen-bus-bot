import { getKosenStatus } from '../src/service.js';

const text = await getKosenStatus();
console.log(text);
