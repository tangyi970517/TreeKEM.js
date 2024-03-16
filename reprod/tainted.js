import {range} from '../src/utils.js';

import {makePerfectTree} from '../src/trees/PerfectTree.js';
const LeftTree = makePerfectTree('leftmost');

import PathRegion from '../src/regions/PathRegion.js';
import FullRegion from '../src/regions/FullRegion.js';

import CounterCrypto from '../src/crypto/counter.js';

import {makeTreeKEM} from '../src/TreeKEM.js';
const [TreeKEM, TaintedTreeKEM] = [PathRegion, FullRegion].map(RegionType => makeTreeKEM(CounterCrypto, {
	skippingSparseNodes: false,
	usingUnmergedNodes: false,
}, LeftTree, RegionType, PathRegion));
const TreeKEMTypes = [
	['TKEM', TreeKEM, false],
	['TKEM_commit', TreeKEM, true],
	['tainted', TaintedTreeKEM, true],
];

import {genOpSeq, testOpSeq} from '../src/bench/simul.js';
import {work} from '../src/bench/worker.js';

export // for worker
const run = function * (scope, setup) {
	const {n, T, pAdd, pRem, options} = setup;
	const seq = [...genOpSeq(n, T, [pAdd, pRem], {
		startingWarm: true,
		...options,
	})];
	const [[ , {admins, nTotal, tTotal}]] = seq.splice(-1, 1);
	const adminSet = new Set(admins ?? []);

	const seqOnlyCommitForUpdate = seq.filter(([op], i, seq) => op !== 'commit' || seq[i-1][0] === 'update');

	for (const [type, TreeKEMType, usingCommit] of TreeKEMTypes) {
		console.warn('run', {...scope, type});
		const seqUsingCommit = usingCommit ? seq : seqOnlyCommitForUpdate;
		const stat = testOpSeq(TreeKEMType, seqUsingCommit, adminSet);
		const value = stat.Enc / nTotal;
		console.warn('end', {...scope, type}, stat);
		yield {...scope, type, ...setup, nTotal, tTotal, stat, value};
	}
};

const SCALE = 15;
const REPEAT = 8; // unspecified in paper

const runAdmin = async function * (Task, scale) {
	const size = 2 ** scale;
	const n = size / 2;
	const T = size * 10;
	const nAdmin = Math.max(n / 64, 1);
	const pAdd = 0.1, pRem = 0.1;

	const threads = [];
	for (const repeat of range(REPEAT)) {
		const scope = {Task, scale, repeat};
		const setup = {size, n, T, nAdmin, pAdd, pRem, options: {
			nAdmin,
			usingAdmin: true,
		}};
		threads.push(work(import.meta.url, 'run', scope, setup));
	}

	for (const thread of threads) {
		for await (const data of thread) {
			const {nAdmin, nTotal, stat} = data;
			for (const [typeUser, value] of [
				['non-admin', (stat.Enc - stat.EncMark) / (nTotal - nAdmin)],
				['admin', stat.EncMark / nAdmin],
				['user', stat.Enc / nTotal],
			]) {
				yield {...data, typeUser, value};
			}
		}
	}
};

const runNonAdmin = async function * (Task, distUserUpd, scale) {
	const size = 2 ** scale;
	const n = size / 2;
	const T = size * 10;
	const pAdd = 0.1, pRem = 0.1;

	const threads = [];
	for (const repeat of range(REPEAT)) {
		const scope = {Task, distUserUpd, scale, repeat};
		const setup = {size, n, T, pAdd, pRem, distUserUpd, options: {
			distUserUpd,
		}};
		threads.push(work(import.meta.url, 'run', scope, setup));
	}

	for (const thread of threads) {
		yield * thread;
	}
};

if (import.meta.main) {

	const Task = Deno.args[0];

	let dataset = null;

	if (Task === 'admin') {
		dataset = async function * () {
			for (const scale of range(3, SCALE+1)) {
				yield * runAdmin(Task, scale);
			}
		}();
	}

	if (Task === 'dist') {
		dataset = async function * () {
			for (const distUserUpd of ['uniform', 'Zipf']) {
				for (const scale of range(3, SCALE+1)) {
					yield * runNonAdmin(Task, distUserUpd, scale);
				}
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
