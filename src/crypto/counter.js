import {assert} from '../utils.js';

class CounterCrypto {
	constructor() {
		this.counts = Object.fromEntries('random,PRG,Gen,Enc,Dec'.split(',').map(key => [key, 0]));
	}

	get stat() {
		return this.counts;
	}

	random() {
		++this.counts.random;
		return 'r';
	}

	PRG(seed, k) {
		assert(seed === 'r');
		++this.counts.PRG;
		return Array(k).fill('r');
	}

	Gen(seed) {
		assert(seed === 'r');
		++this.counts.Gen;
		return ['pk', 'sk'];
	}
	Enc(pk, _m) {
		assert(pk === 'pk');
		++this.counts.Enc;
		return 'c';
	}
	Dec(sk, c) {
		assert(sk === 'sk');
		assert(c === 'c');
		++this.counts.Dec;
		return null;
	}
}

export default CounterCrypto;
