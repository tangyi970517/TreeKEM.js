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

import {genOpSeq, testOpSeq} from '../src/bench/simul.js';

const run = function * (scope, seq) {
	for (const [type, TreeType] of TreeTypes) {
		console.warn('run', scope);
		const TreeKEMType = makeTreeKEM(CounterCrypto, {
			usingUnmergedNodes: false,
			usingSKE: true,
		}, TreeType, FullRegion, PathRegion);
		const stat = testOpSeq(TreeKEMType, seq);
		console.warn('end', scope, stat);
		yield [type, stat];
	}
};

const SCALE = 14;
const REPEAT = 8;

const runTask = function * (Task, scale, {
	pRem = 0.1,
	setting = 'normal', gen = genOpSeq,
} = {}) {
	const size = 2 ** scale;
	const n = size / 2;
	const T = size * 10;
	const pAdd = 0.2 - pRem;

	for (const repeat of range(REPEAT)) {
		const seq = [...gen(n, T, [pAdd, pRem], {
			nAdmin: 1,
			usingAdmin: true,
			allowingUpdByOther: true,
			allowingUpdOfAdmin: false,
		})];
		const [[ , {tTotal}]] = seq.splice(-1, 1);

		const scope = {Task, setting, pRem, scale, repeat};
		const setup = {size, n, T, pAdd, pRem, tTotal};

		for (const [type, stat] of run(scope, seq)) {
			const value = stat.SEnc / tTotal.commit;
			yield {...scope, ...setup, type, ...stat, value};
		}
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
		dataset = function * () {
			for (const scale of range(3, SCALE+1)) {
				yield * runTask(Task, scale);
				yield * runTask(Task, scale, {setting: 'remove 99%', gen: genRemove99});
			}
		}();
	}

	if (Task === 'prob') {
		dataset = function * () {
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
		for (const data of dataset) {
			console.log(_++ ? ',' : ' ', JSON.stringify(data));
		}
		console.log(']');
	}

}
