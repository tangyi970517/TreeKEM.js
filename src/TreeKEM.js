import {assert, sum} from './utils.js';

const isSkeleton = (node, epoch, skeletonExtra) => !node.isAllRemoved && (node.epoch === epoch || skeletonExtra.has(node));

const recompose = (node, taintMap) => {
	assert(!node.isLeaf);
	if (!node.decompose) {
		return;
	}
	const nodeMain = node.decompose[0];
	if (nodeMain.isAllRemoved) {
		return;
	}
	if (!nodeMain.data.pk) {
		recompose(nodeMain, taintMap);
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

const skeletonIter = function * (root, epoch, skeletonExtra, path, regionPredicate, trace = new Map()) {
	assert(isSkeleton(root, epoch, skeletonExtra));
	skeletonExtra.delete(root);
	if (root.isLeaf) {
		assert(root.data.pk);
		return;
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
		if (!isInSkeleton[i]) {
			continue;
		}
		yield * skeletonIter(child, epoch, skeletonExtra, path, regionPredicate, trace);
		if (!(path.has(child) || regionPredicate(child))) {
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
	const isInRegion = path.has(root) || regionPredicate(root);
	if (!isInRegion) {
		assert(!childTrace);
		yield [root, false, null];
	}
	yield [root, isInRegion, childTrace];
};

import DefaultCrypto from './crypto/DefaultCrypto.js';
import LeftTree from './trees/LeftTree.js';
import PathRegion from './regions/PathRegion.js';

export
const makeTreeKEM = (
	Crypto = DefaultCrypto,
	{
		usingUnmergedNodes = true,
		usingUnmergedNodesForBlank = usingUnmergedNodes,
		usingUnmergedNodesForSecret = usingUnmergedNodes,
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
		this.cryptoUser = new Crypto();
	}

	init(ids, a = ids[0]) {
		++this.epoch;
		const n = ids.length;
		assert(this.tree === null);
		this.tree = TreeType.init(n, this.epoch);
		for (const leaf of this.tree.getLeaves(true)) {
			const i = this.users.size;
			const id = ids[i];
			const [pk, sk] = this.cryptoUser.PKE_Gen(this.cryptoUser.random());
			this.constructor.initData(leaf, id, pk, sk);
			this.users.set(id, leaf);
		}
		assert(this.users.size === n);

		assert(this.users.has(a));
		const ua = this.users.get(a);

		const skeletonExtra = new Set();

		for (const _ of function * () {
		yield * this.skeletonGen(ua, this.tree, this.epoch, skeletonExtra);
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
		const [pk, sk] = this.cryptoUser.PKE_Gen(this.cryptoUser.random());
		this.constructor.initData(leafNew, b, pk, sk);
		this.users.set(b, leafNew);
		const ua = this.users.get(a), ub = this.users.get(b);
		const treeOld = this.tree;
		this.tree = this.tree.add(this.epoch, ub, ua);

		const skeletonExtra = new Set();

		for (const _ of function * () {
		yield * this.skeletonGen(ua, this.tree, this.epoch, skeletonExtra);
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
		if (root.epoch < this.epoch) {
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

		for (const _ of function * () {
		yield * this.skeletonGen(ua, this.tree, this.epoch, skeletonExtra);
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

		const skeletonExtra = new Set(ub.getPath(this.epoch));
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

		for (const _ of function * () {
		yield * this.skeletonGen(ua, this.tree, this.epoch, skeletonExtra);
		}.bind(this)()) ;
	}

	* skeletonGen(leaf, root, epoch, skeletonExtra) {
		const traceOverwrite = new Map();
		let nodePrev = null;
		for (const node of leaf.getPath(epoch)) {
			if (nodePrev) {
				traceOverwrite.set(node, nodePrev);
			}
			nodePrev = node;
		}
		const path = traceOverwrite;

		const regionPredicate = node => !node.isLeaf && this.regionEnc.isInRegion(node, leaf, epoch, root, path);
		const seedMap = new Map();
		for (const [node, isInRegion, childTrace] of skeletonIter(root, epoch, skeletonExtra, path, regionPredicate, traceOverwrite)) {
			assert(!node.isLeaf);
			assert(childTrace === null || node.children.indexOf(childTrace) >= 0);
			node.data.sizeBlank = sum(node.children.map(child => child.data.sizeBlank ?? 0), Number(!isInRegion));
			node.data.pk = null;
			node.data.sk = null;
			node.data.kk = null;
			node.data.unmerged = null;
			rinseNode(this.taint, node);
			if (!isInRegion) {
				if (usingUnmergedNodesForBlank) {
					recompose(node, this.taint);
				}
				continue;
			}
			if (usingUnmergedNodesForSecret) {
				recompose(node, this.taint);
				if (node.data.pk) {
					continue;
				}
			}
			let seed;
			if (seedMap.has(childTrace)) {
				seed = seedMap.get(childTrace);
				seedMap.delete(childTrace);
			} else {
				assert(!childTrace || usingUnmergedNodesForSecret);
				seed = this.crypto.random();
			}
			const [seedNext, secret, secretSKE] = this.crypto.PRG(seed, 3);
			seedMap.set(node, seedNext);
			[node.data.pk, node.data.sk] = this.crypto.PKE_Gen(secret);
			node.data.kk = this.crypto.SKE_Gen(secretSKE);
			if (!path.has(node)) {
				taintNode(this.taint, leaf, node);
			}
			for (const child of node.children) {
				if (child === childTrace) {
					continue;
				}
				yield * this.skeletonEnc(child, seed, leaf, path);
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

		if (seedMap.has(root)) {
			this.secret = seedMap.get(root);
		} else {
			assert(seedMap.size === 0 || usingUnmergedNodesForSecret);
			this.secret = this.crypto.random();
			yield * this.skeletonEnc(root, this.secret, leaf, path);
		}
	}

	* skeletonEnc(root, seed, leaf, path) {
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
				yield this.crypto.SKE_Enc(root.data.kk, seed);
			} else {
				yield this.crypto.PKE_Enc(root.data.pk, seed);
			}
			if (root.data.unmerged) {
				for (const node of root.data.unmerged) {
					yield * this.skeletonEnc(node, seed, leaf, path);
				}
			}
		} else {
			assert(!root.isLeaf);
			for (const child of root.children) {
				yield * this.skeletonEnc(child, seed, leaf, path);
			}
		}
	}
}
	);
};

export default makeTreeKEM();
