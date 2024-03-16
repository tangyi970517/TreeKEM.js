import {assert, range, shuffle} from '../src/utils.js';

import {makeLeftTree} from '../src/trees/LeftTree.js';
const LeftTree = makeLeftTree('leftmost');
import {make23Tree} from '../src/trees/BTree.js';
const $23Tree = make23Tree('optimal', 'borrow-merge');
import {makeLLRBTree} from '../src/trees/LLRBTree.js';
const LLRBTree = makeLLRBTree('2-3', 'optimal', 'borrow-merge');
const TreeTypes = [
	['LBBTs', LeftTree],
	['2-3 Trees', $23Tree],
	['LLRBTs', LLRBTree],
];

import PathRegion from '../src/regions/PathRegion.js';
import FullRegion from '../src/regions/FullRegion.js';

import CounterCrypto from '../src/crypto/counter.js';

import {makeTreeKEM} from '../src/TreeKEM.js';
const TreeKEMTypes = TreeTypes.map(([type, TreeType]) => [type, makeTreeKEM(CounterCrypto, {
	aligningTrace: false,
	skippingSparseNodes: false,
	usingUnmergedNodes: false,
	usingSKE: true,
}, TreeType, FullRegion, PathRegion)]);

import {genOpSeq, testOpSeq} from '../src/bench/simul.js';
import {work} from '../src/bench/worker.js';

export // for worker
const run = function * (scope, setup) {
	const {n, T, pAdd, pRem, setting} = setup;
	const gen = {
		'normal': genOpSeq,
		'remove 99%': genRemove99,
	}[setting];
	const seq = [...gen(n, T, [pAdd, pRem], {
		nAdmin: 1,
		usingAdmin: true,
		allowingUpdByOther: true,
		allowingUpdOfAdmin: false,
	})];
	const [[ , {nTotal, tTotal}]] = seq.splice(-1, 1);

	for (const [type, TreeKEMType] of TreeKEMTypes) {
		console.warn('run', {...scope, type});
		const stat = testOpSeq(TreeKEMType, seq);
		const value = stat.SEnc / tTotal.commit;
		console.warn('end', {...scope, type}, stat, value);
		yield {...scope, type, ...setup, nTotal, tTotal, stat, value};
	}
};

const SCALE = 14;
const REPEAT = 8;

const runTask = async function * (Task, scale, {
	pRem = 0.1,
	setting = 'normal',
} = {}) {
	const size = 2 ** scale;
	const n = size / 2;
	const T = size * 10;
	const pAdd = 0.2 - pRem;

	const threads = [];
	for (const repeat of range(REPEAT)) {
		const scope = {Task, scale, ...(pRem !== 0.1 ? {pRem} : {}), ...(setting !== 'normal' ? {setting} : {}), repeat};
		const setup = {size, n, T, pAdd, pRem, setting};
		threads.push(work(import.meta.url, 'run', scope, setup));
	}

	for (const thread of threads) {
		yield * thread;
	}
};

const genRemove99 = (n, T, ...args) => {
	const nAfter = Math.ceil(n / 100);
	const tAfter = Math.ceil(T / 100);
	const seq = [...genOpSeq(nAfter, tAfter, ...args)];

	const [op, users, admin] = seq[0];
	assert(op === 'init');
	seq[0] = ['_reset'];

	const usersRem = Array.from({length: n - nAfter}, (_, i) => -i-1);
	const seqRem = usersRem.map(u => ['remove', admin, u]);

	const usersInit = shuffle(users.concat(usersRem));
	const opInit = ['init', usersInit, admin];

	return [].concat(
		[opInit],
		seqRem,
		seq,
	);
};

if (import.meta.main) {

	const Task = Deno.args[0];

	let dataset = null;

	if (Task === 'size') {
		dataset = async function * () {
			for (const scale of range(3, SCALE+1)) {
				yield * runTask(Task, scale);
				yield * runTask(Task, scale, {setting: 'remove 99%'});
			}
		}();
	}

	if (Task === 'prob') {
		dataset = async function * () {
			const scale = SCALE;
			for (const i of range(5)) {
				const pRem = 0.1 + (i+1) * 0.005;
				yield * runTask(Task, scale, {pRem});
			}
		}();
	}

	if (dataset) {
		console.log('[');
		let _ = 0;
		for await (const data of dataset) {
			console.log(_++ ? ',' : ' ', JSON.stringify(data));
		}
		console.log(']');
	}

}
