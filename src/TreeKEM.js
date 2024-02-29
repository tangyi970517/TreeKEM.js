import {assert, sum} from './utils.js';

const isSkeleton = (node, epoch, skeletonExtra) => node.epoch === epoch || skeletonExtra.has(node);

const recompose = (node, taintMap) => {
	if (!node.decompose) {
		return;
	}
	const nodeMain = node.decompose[0];
	if (!nodeMain.data.pk) {
		recompose(nodeMain);
	}
	if (nodeMain.data.pk) {
		node.data.pk = nodeMain.data.pk;
		node.data.sk = nodeMain.data.sk;
		node.data.kk = nodeMain.data.kk;
		node.data.unmerged = [].concat(nodeMain.data.unmerged ?? [], node.decompose.slice(1));
		if (!nodeMain.data.taintBy) {
			return;
		}
		for (const leaf of nodeMain.data.taintBy) {
			taintNode(taintMap, leaf, node);
		}
		rinseNode(taintMap, nodeMain);
	}
};

const taintNode = (taintMap, user, node) => {
	if (!taintMap.has(user)) {
		taintMap.set(user, new Set());
	}
	const taintSet = taintMap.get(user);
	assert(!taintSet.has(node));
	taintSet.add(node);
	if (!node.data.taintBy) {
		node.data.taintBy = new Set();
	}
	assert(!node.data.taintBy.has(user));
	node.data.taintBy.add(user);
};
const rinseNode = (taintMap, node) => {
	if (!node.data.taintBy) {
		return;
	}
	for (const user of node.data.taintBy) {
		assert(taintMap.has(user));
		const taintSet = taintMap.get(user);
		assert(taintSet.has(node));
		taintSet.delete(node);
		if (taintSet.size === 0) {
			taintMap.delete(user);
		}
	}
	node.data.taintBy = null;
};

const rinseTill = (taintMap, node, epochNew, rootNew) => {
	if (node.getRoot(epochNew, true) === rootNew) {
		return;
	}
	for (const child of node.children) {
		rinseTill(taintMap, child, epochNew, rootNew);
	}
	rinseNode(taintMap, node);
};

const skeletonGen = function * (root, epoch, skeletonExtra, path, regionPredicate, crypto, trace = new Map()) {
	assert(isSkeleton(root, epoch, skeletonExtra));
	skeletonExtra.delete(root);
	if (root.isAllRemoved) {
		return null;
	}
	if (root.isLeaf) {
		assert(root.data.pk);
		return null;
	}
	const isInSkeleton = root.children.map(child => isSkeleton(child, epoch, skeletonExtra));
	/**
	 *
	 * choose trace for PRG:
	 * - must be in skeleton and in region
	 * - choose given `trace` if valid
	 * - choose `childTrace` if valid
	 * - otherwise choose, e.g., first valid
	 *
	 */
	const childTraceGiven = trace.get(root);
	let traceInSkeletonCapRegion = null;
	let childTraceInSkeletonCapRegion = null;
	let firstInSkeletonCapRegion = null;
	for (const [i, child] of root.children.entries()) {
		if (!(isInSkeleton[i] && (path.has(child) || regionPredicate(child)))) {
			continue;
		}
		if (child === childTraceGiven) {
			traceInSkeletonCapRegion = child;
		}
		if (child === root.childTrace) {
			childTraceInSkeletonCapRegion = child;
		}
		if (firstInSkeletonCapRegion === null) {
			firstInSkeletonCapRegion = child;
		}
	}
	const childTrace = traceInSkeletonCapRegion ?? childTraceInSkeletonCapRegion ?? firstInSkeletonCapRegion;
	let seedTrace = null;
	for (const [i, child] of root.children.entries()) {
		if (!isInSkeleton[i]) {
			continue;
		}
		const seed = yield * skeletonGen(child, epoch, skeletonExtra, path, regionPredicate, crypto, trace);
		if (child === childTrace) {
			seedTrace = seed;
		}
	}
	root.data.pk = null;
	root.data.sk = null;
	root.data.kk = null;
	root.data.unmerged = null;
	let seed = null;
	const isInRegion = path.has(root) || regionPredicate(root);
	if (isInRegion) {
		if (!seedTrace) {
			seedTrace = crypto.random();
		}
		let secret, secretSKE;
		[seed, secret, secretSKE] = crypto.PRG(seedTrace, 3);
		[root.data.pk, root.data.sk] = crypto.PKE_Gen(secret);
		root.data.kk = crypto.SKE_Gen(secretSKE);
		yield [root, seedTrace, childTrace];
	} else {
		yield [root, null, null];
	}
	root.data.sizeBlank = sum(root.children.map(child => child.data.sizeBlank ?? 0), Number(!root.data.pk));
	return seed;
};

const skeletonEnc = function * (root, seed, leaf, path, crypto) {
	if (root.isAllRemoved) {
		return;
	}
	if (root === leaf) {
		return;
	}
	assert(!root.isLeaf || root.data.pk);
	assert(!root.isLeaf || !root.data.kk);
	assert(root.isLeaf || (!root.data.pk) === (!root.data.kk));
	if (root.data.pk) {
		if (root.data.kk && (path.has(root) || root.data.taintBy?.has(leaf))) {
			yield crypto.SKE_Enc(root.data.kk, seed);
		} else {
			yield crypto.PKE_Enc(root.data.pk, seed);
		}
		if (root.data.unmerged) {
			for (const node of root.data.unmerged) {
				yield * skeletonEnc(node, seed, leaf, path, crypto);
			}
		}
	} else {
		assert(!root.isLeaf);
		for (const child of root.children) {
			yield * skeletonEnc(child, seed, leaf, path, crypto);
		}
	}
};

import DefaultCrypto from './crypto/DefaultCrypto.js';
import LeftTree from './trees/LeftTree.js';
import PathRegion from './regions/PathRegion.js';

export
const makeTreeKEM = (
	Crypto = DefaultCrypto,
	{
		usingUnmergedNodes = true,
	} = {},
	TreeType = LeftTree,
	RegionTypeEnc = PathRegion, RegionTypeDec = PathRegion,
) => {
	return (
class TreeKEM {
	constructor() {
		this.tree = null;
		this.epoch = 0;
		this.users = new Map();

		this.regionEnc = new RegionTypeEnc();
		this.regionDec = new RegionTypeDec();
		this.taint = new Map();

		this.crypto = new Crypto();
	}

	init(ids) {
		++this.epoch;
		const n = ids.length;
		assert(this.tree === null);
		this.tree = TreeType.init(n, this.epoch);
		for (const leaf of this.tree.getLeaves(true)) {
			const i = this.users.size;
			const id = ids[i];
			const [pk, sk] = this.crypto.PKE_Gen(this.crypto.random());
			this.constructor.initData(leaf, id, pk, sk);
			this.users.set(id, leaf);
		}
		assert(this.users.size === n);

		const a = ids[0];
		const ua = this.users.get(a);

		const skeletonExtra = new Set();

		for (const _ of function * () {
		yield * this.processSkeleton(ua, this.tree, this.epoch, skeletonExtra);
		}.bind(this)()) ;

		const cryptoOld = this.crypto;
		this.crypto = new Crypto();
		return cryptoOld;
	}
	static initData(leaf, id, pk, sk = null) {
		leaf.data.id = id;
		leaf.data.pk = pk;
		leaf.data.sk = sk;
		leaf.data.kk = null;
		leaf.data.taintBy = null;
		leaf.data.sizeBlank = 0;
	}

	add(a, b, clearingOldNodes = true) {
		assert(this.users.has(a) && !this.users.has(b));
		++this.epoch;
		const leafNew = new TreeType(this.epoch);
		const [pk, sk] = this.crypto.PKE_Gen(this.crypto.random());
		this.constructor.initData(leafNew, b, pk, sk);
		this.users.set(b, leafNew);
		const ua = this.users.get(a), ub = this.users.get(b);
		const treeOld = this.tree;
		this.tree = this.tree.add(this.epoch, ub, ua);

		const skeletonExtra = new Set();

		for (const _ of function * () {
		yield * this.processSkeleton(ua, this.tree, this.epoch, skeletonExtra);
		}.bind(this)()) ;

		rinseTill(this.taint, treeOld, this.epoch, this.tree);
		if (clearingOldNodes) {
			treeOld.clearTill(this.epoch, this.tree);
		}

		return clearingOldNodes ? null : treeOld;
	}

	remove(a, b, clearingOldNodes = true) {
		assert(this.users.has(a) && this.users.has(b) && b !== a);
		++this.epoch;
		const ua = this.users.get(a), ub = this.users.get(b);
		this.users.delete(b);
		const treeOld = this.tree;
		this.tree = this.tree.remove(this.epoch, ub, ua);

		const skeletonExtra = new Set();
		const root = this.tree;
		if (root.epoch < this.epoch && !root.isLeaf) {
			skeletonExtra.add(root);
		}
		if (this.taint.has(ub)) {
			for (const node of this.taint.get(ub)) {
				assert(node.data.taintBy?.has(ub));
				node.data.taintBy.delete(ub);
				if (node.data.taintBy.size === 0) {
					node.data.taintBy = null;
				}
				if (node.getRoot(this.epoch, true) !== this.tree) {
					continue;
				}
				for (const ancestor of node.getPath(this.epoch)) {
					if (skeletonExtra.has(ancestor)) {
						break;
					}
					skeletonExtra.add(ancestor);
				}
			}
			this.taint.delete(ub);
		}

		assert((root.epoch === this.epoch || skeletonExtra.size > 0) || this.users.size === 1);
		if (root.epoch === this.epoch || skeletonExtra.size > 0)
		for (const _ of function * () {
		yield * this.processSkeleton(ua, this.tree, this.epoch, skeletonExtra);
		}.bind(this)()) ;

		rinseTill(this.taint, treeOld, this.epoch, this.tree);
		if (clearingOldNodes) {
			treeOld.clearTill(this.epoch, this.tree);
		}

		return clearingOldNodes ? null : treeOld;
	}

	update(b, a = b) {
		assert(this.users.has(a) && this.users.has(b));
		++this.epoch;
		const ua = this.users.get(a), ub = this.users.get(b);

		const skeletonExtra = new Set(ub.getPath(this.epoch, false));
		if (this.taint.has(ub)) {
			for (const node of this.taint.get(ub)) {
				assert(node.getRoot(this.epoch, true) === this.tree);
				for (const ancestor of node.getPath(this.epoch)) {
					if (skeletonExtra.has(ancestor)) {
						break;
					}
					skeletonExtra.add(ancestor);
				}
			}
		}

		assert(skeletonExtra.size > 0 || this.users.size === 1);
		if (skeletonExtra.size > 0)
		for (const _ of function * () {
		yield * this.processSkeleton(ua, this.tree, this.epoch, skeletonExtra);
		}.bind(this)()) ;
	}

	* processSkeleton(leaf, root, epoch, skeletonExtra) {
		const traceOverwrite = new Map();
		let nodePrev = null;
		for (const node of leaf.getPath(epoch)) {
			if (nodePrev) {
				traceOverwrite.set(node, nodePrev);
			}
			nodePrev = node;
		}
		const path = traceOverwrite;

		const regionPredicate = node => this.regionEnc.isInRegion(node, leaf, epoch, root, path);
		for (const [node, seed, childTrace] of skeletonGen(root, epoch, skeletonExtra, path, regionPredicate, this.crypto, traceOverwrite)) {
			assert(!node.isLeaf);
			assert(childTrace === null || node.children.indexOf(childTrace) >= 0);
			rinseNode(this.taint, node);
			if (!seed) {
				if (usingUnmergedNodes) {
					recompose(node, this.taint);
				}
				continue;
			}
			if (!path.has(node)) {
				taintNode(this.taint, leaf, node);
			}
			for (const child of node.children) {
				if (node === childTrace) {
					continue;
				}
				yield * skeletonEnc(child, seed, leaf, path, this.crypto);
			}
			for (const [leafOther, _] of this.taint) {
				if (leafOther === leaf) {
					continue;
				}
				const path = new Set(leafOther.getPath(epoch));
				if (path.has(node) || !this.regionDec.isInRegion(node, leafOther, epoch, root, path)) {
					continue;
				}
				assert(leafOther.data.pk);
				this.crypto.PKE_Enc(leafOther.data.pk, seed);
				taintNode(this.taint, leafOther, node);
			}
		}
		assert(skeletonExtra.size === 0);
	}
}
	);
};

export default makeTreeKEM();
