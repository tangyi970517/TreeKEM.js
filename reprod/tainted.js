import {range} from '../src/utils.js';

import {makePerfectTree} from '../src/trees/PerfectTree.js';
const LeftTree = makePerfectTree('leftmost');

import PathRegion from '../src/regions/PathRegion.js';
import FullRegion from '../src/regions/FullRegion.js';

import CounterCrypto from '../src/crypto/counter.js';

import {makeTreeKEM} from '../src/TreeKEM.js';
const TreeKEM = makeTreeKEM(CounterCrypto, {
	usingUnmergedNodes: false,
}, LeftTree, PathRegion, PathRegion);
const TaintedTreeKEM = makeTreeKEM(CounterCrypto, {
	usingUnmergedNodes: false,
}, LeftTree, FullRegion, PathRegion);
const TreeKEMTypes = [
	['TKEM', TreeKEM, false],
	['TKEM_commit', TreeKEM, true],
	['tainted', TaintedTreeKEM, true],
];

import {genOpSeq, testOpSeq} from '../src/bench/simul.js';

const run = function * (scope, seq, ...args) {
	const seqOnlyCommitForUpdate = seq.filter(([op], i, seq) => op !== 'commit' || seq[i-1][0] === 'update');

	for (const [type, TreeKEMType, usingCommit] of TreeKEMTypes) {
		console.warn('run', scope);
		const seqUsingCommit = usingCommit ? seq : seqOnlyCommitForUpdate;
		const stat = testOpSeq(TreeKEMType, seqUsingCommit, ...args);
		console.warn('end', scope, stat);
		yield [type, stat];
	}
};

const SCALE = 15;
const REPEAT = 8; // unspecified in paper

const runAdmin = function * (Task, scale) {
	const size = 2 ** scale;
	const n = size / 2;
	const T = size * 10;
	const nAdmin = Math.max(n / 64, 1);
	const pAdd = 0.1, pRem = 0.1;

	for (const repeat of range(REPEAT)) {
		const seq = [...genOpSeq(n, T, [pAdd, pRem], {
			nAdmin,
			startingWarm: true,
			usingAdmin: true,
		})];
		const [[ , {admins, nTotal, tTotal}]] = seq.splice(-1, 1);
		const adminSet = new Set(admins);

		const scope = {Task, scale, repeat};
		const setup = {size, n, T, pAdd, pRem, nAdmin, nTotal, tTotal};

		for (const [type, stat] of run(scope, seq, adminSet)) {
			for (const [typeUser, value] of [
				['non-admin', (stat.Enc - stat.EncMark) / (nTotal - nAdmin)],
				['admin', stat.EncMark / nAdmin],
				['user', stat.Enc / nTotal],
			]) {
				yield {...scope, ...setup, type, ...stat, typeUser, value};
			}
		}
	}
};

const runNonAdmin = function * (Task, distUserUpd, scale) {
	const size = 2 ** scale;
	const n = size / 2;
	const T = size * 10;
	const pAdd = 0.1, pRem = 0.1;

	for (const repeat of range(REPEAT)) {
		const seq = [...genOpSeq(n, T, [pAdd, pRem], {
			startingWarm: true,
			distUserUpd,
		})];
		const [[ , {nTotal, tTotal}]] = seq.splice(-1, 1);

		const scope = {Task, distUserUpd, scale, repeat};
		const setup = {size, n, T, pAdd, pRem, distUserUpd, nTotal, tTotal};

		for (const [type, stat] of run(scope, seq)) {
			const value = stat.Enc / nTotal;
			yield {...scope, ...setup, type, ...stat, value};
		}
	}
};

if (import.meta.main) {

	const Task = Deno.args[0];

	let dataset = null;

	if (Task === 'admin') {
		dataset = function * () {
			for (const scale of range(3, SCALE+1)) {
				yield * runAdmin(Task, scale);
			}
		}();
	}

	if (Task === 'dist') {
		dataset = function * () {
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
		for (const data of dataset) {
			console.log(_++ ? ',' : ' ', JSON.stringify(data));
		}
		console.log(']');
	}

}
