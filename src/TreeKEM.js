import {assert, sum} from './utils.js';

const processSkeleton = function * (leaf, epoch, root, skeletonExtra, path, {regionEnc, regionDec, taint}, crypto) {
	const regionPredicate = node => regionEnc.isInRegion(node, leaf, epoch, root, path);
	for (const [node, seed, childTrace] of skeletonGen(root, epoch, skeletonExtra, path, regionPredicate, crypto)) {
		assert(!node.isLeaf);
		assert(childTrace === null || node.children.indexOf(childTrace) >= 0);
		rinseNode(taint, node);
		if (!seed) {
			recompose(root, taint);
			continue;
		}
		if (!path.has(node)) {
			taintNode(taint, leaf, node);
		}
		for (const child of node.children) {
			if (node === childTrace) {
				continue;
			}
			yield * skeletonEnc(child, seed, crypto);
		}
		for (const [leafOther, _] of taint) {
			if (leafOther === leaf) {
				continue;
			}
			const path = new Set(leafOther.getPath(epoch));
			if (path.has(node) || !regionDec.isInRegion(node, leafOther, epoch, root, path)) {
				continue;
			}
			assert(leafOther.data.pk);
			crypto.Enc(leafOther.data.pk, seed);
			taintNode(taint, leafOther, node);
		}
	}
	assert(skeletonExtra.size === 0);
};

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

const skeletonGen = function * (root, epoch, skeletonExtra, path, regionPredicate, crypto) {
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
	 * - choose `childTrace` if valid
	 * - otherwise choose, e.g., first valid
	 *
	 */
	let firstInSkeletonCapRegion = null
	let childTrace = null;
	for (const [i, child] of root.children.entries()) {
		if (!(isInSkeleton[i] && (path.has(child) || regionPredicate(child)))) {
			continue;
		}
		if (firstInSkeletonCapRegion === null) {
			firstInSkeletonCapRegion = child;
		}
		if (child === root.childTrace) {
			childTrace = child;
		}
	}
	if (childTrace === null) {
		childTrace = firstInSkeletonCapRegion;
	}
	let seedTrace = null;
	for (const [i, child] of root.children.entries()) {
		if (!isInSkeleton[i]) {
			continue;
		}
		const seed = yield * skeletonGen(child, epoch, skeletonExtra, path, regionPredicate, crypto);
		if (child === childTrace) {
			seedTrace = seed;
		}
	}
	root.data.pk = null;
	root.data.sk = null;
	root.data.unmerged = null;
	let seed = null;
	const isInRegion = path.has(root) || regionPredicate(root);
	if (isInRegion) {
		let secret;
		if (!seedTrace) {
			seedTrace = crypto.random();
		}
		[seed, secret] = crypto.PRG(seedTrace, 2);
		[root.data.pk, root.data.sk] = crypto.Gen(secret);
		yield [root, seedTrace, childTrace];
	} else {
		yield [root, null, null];
	}
	root.data.sizeBlank = sum(root.children.map(child => child.data.sizeBlank ?? 0), Number(!root.data.pk));
	return seed;
};

const skeletonEnc = function * (root, seed, crypto) {
	if (root.isAllRemoved) {
		return;
	}
	assert(!root.isLeaf || root.data.pk);
	if (root.data.pk) {
		yield crypto.Enc(root.data.pk, seed);
		if (root.data.unmerged) {
			for (const node of root.data.unmerged) {
				skeletonEnc(node, seed, crypto);
			}
		}
	} else {
		for (const child of root.children) {
			skeletonEnc(child, seed, crypto);
		}
	}
};

import DefaultCrypto from './crypto/DefaultCrypto.js';
import LeftTree from './trees/LeftTree.js';
import PathRegion from './regions/PathRegion.js';

export
const makeTreeKEM = (Crypto = DefaultCrypto, TreeType = LeftTree, RegionTypeEnc = PathRegion, RegionTypeDec = PathRegion) => {
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

	init(id_pks) {
		++this.epoch;
		const n = id_pks.length;
		assert(this.tree === null);
		this.tree = TreeType.init(n, this.epoch);
		for (const leaf of this.tree.getLeaves(true)) {
			const i = this.users.size;
			const [id, pk] = id_pks[i];
			this.constructor.initData(leaf, id, pk);
			this.users.set(id, leaf);
		}
		assert(this.users.size === n);

		const [a] = id_pks[0];
		const ua = this.users.get(a);

		const skeletonExtra = new Set();

		const path = new Set(ua.getPath(this.epoch));
		for (const _ of function * () {
		yield * processSkeleton(ua, this.epoch, this.tree, skeletonExtra, path, this, this.crypto);
		}.bind(this)()) ;

		const cryptoOld = this.crypto;
		this.crypto = new Crypto();
		return cryptoOld;
	}
	static initData(leaf, id, pk, sk = null) {
		leaf.data.id = id;
		leaf.data.pk = pk;
		leaf.data.sk = sk;
		leaf.data.sizeBlank = 0;
	}

	add(a, b, pk, clearingOldNodes = true) {
		assert(this.users.has(a) && !this.users.has(b));
		++this.epoch;
		const leafNew = new TreeType(this.epoch);
		this.constructor.initData(leafNew, b, pk);
		this.users.set(b, leafNew);
		const ua = this.users.get(a), ub = this.users.get(b);
		const treeOld = this.tree;
		this.tree = this.tree.add(this.epoch, ub, ua);

		const skeletonExtra = new Set();

		const path = new Set(ua.getPath(this.epoch));
		for (const _ of function * () {
		yield * processSkeleton(ua, this.epoch, this.tree, skeletonExtra, path, this, this.crypto);
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

		const path = new Set(ua.getPath(this.epoch));
		for (const _ of function * () {
		yield * processSkeleton(ua, this.epoch, this.tree, skeletonExtra, path, this, this.crypto);
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
					skeletonExtra.add(ancestor);
				}
			}
		}

		const path = new Set(ua.getPath(this.epoch));
		for (const _ of function * () {
		yield * processSkeleton(ua, this.epoch, this.tree, skeletonExtra, path, this, this.crypto);
		}.bind(this)()) ;
	}
}
	);
};

export default makeTreeKEM();
