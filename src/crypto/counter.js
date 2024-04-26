import {assert} from '../utils.js';

class CounterCrypto {
	constructor() {
		this.counts = Object.fromEntries('random,PRG,Gen,Enc,Dec,SGen,SEnc,SDec,OTP,OTPInv'.split(',').map(key => [key, 0]));
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

	PKE_Gen(seed) {
		assert(seed === 'r');
		++this.counts.Gen;
		return ['pk', 'sk'];
	}
	PKE_Enc(pk, _m) {
		assert(pk === 'pk');
		++this.counts.Enc;
		return 'c';
	}
	PKE_Dec(sk, c) {
		assert(sk === 'sk');
		assert(c === 'c');
		++this.counts.Dec;
		return null;
	}

	SKE_Gen(seed) {
		assert(seed === 'r');
		++this.counts.SGen;
		return 'k';
	}
	SKE_Enc(k, _m) {
		assert(k === 'k');
		++this.counts.SEnc;
		return 'c_k';
	}
	SKE_Dec(k, c) {
		assert(k === 'k');
		assert(c === 'c_k');
		++this.counts.SDec;
		return null;
	}

	OTP_Enc(r, _m) {
		assert(r === 'r');
		++this.counts.OTP;
		return 'c_r';
	}
	OTP_Dec(r, c) {
		assert(r === 'r');
		assert(c === 'c_r');
		++this.counts.OTPInv;
		return null;
	}
}

export default CounterCrypto;
