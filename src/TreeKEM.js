import {assert, sum} from './utils.js';

class TreeState {
	constructor(epochInit, TreeType) {
		this.epoch = epochInit;
		this.root = Object.create(TreeType.prototype); // fake tree object
	}

	init(n) {
		const {epoch, root} = this;
		const epochNew = epoch.step();
		[this.epoch, this.root] = root.constructor.init(n, epochNew);
		assert(root.Epoch.ge(this.epoch, epochNew));
		return [epoch, root];
	}
	add(hint) {
		const {epoch, root} = this;
		const epochNew = epoch.step();
		const leafNew = new root.constructor(epochNew);
		[this.epoch, this.root] = root.add(epochNew, leafNew, hint);
		assert(root.Epoch.ge(this.epoch, epochNew));
		return [epoch, root, leafNew];
	}
	remove(node, hint) {
		const {epoch, root} = this;
		const epochNew = epoch.step();
		[this.epoch, this.root] = root.remove(epochNew, node, hint);
		assert(root.Epoch.ge(this.epoch, epochNew));
		return [epoch, root];
	}
	update(node, hint) {
		const {epoch, root} = this;
		const epochNew = epoch.step();
		[this.epoch, this.root] = root.update(epochNew, node, hint);
		assert(root.Epoch.ge(this.epoch, epochNew));
		return [epoch, root];
	}
}

const recompose = node => {
	assert(!node.isLeaf);
	if (!node.decompose) {
		return;
	}
	if (node.data.recomposed) {
		return;
	}
	node.data.recomposed = true;
	const nodeMain = node.decompose[0];
	if (nodeMain.isAllRemoved) {
		return;
	}
	let nodeSecret;
	if (nodeMain.data.pk) {
		nodeSecret = nodeMain;
	} else {
		nodeSecret = recompose(nodeMain);
	}
	assert((!nodeMain.data.pk) === (!nodeSecret));
	if (nodeMain.data.pk) {
		node.data.pk = nodeMain.data.pk;
		node.data.sk = nodeMain.data.sk;
		node.data.kk = nodeMain.data.kk;
		node.data.unmerged = [].concat(nodeMain.data.unmerged ?? [], node.decompose.slice(1));
	}
	return nodeSecret;
};

class TaintManager {
	constructor() {
		this.taintMap = new WeakMap();
		this.taintByMap = new WeakMap();
	}

	taint(user, node) {
		const {taintMap, taintByMap} = this;
		if (!taintMap.has(user)) {
			taintMap.set(user, new Set());
		}
		const taintSet = taintMap.get(user);
		assert(!taintSet.has(node));
		taintSet.add(node);
		if (!taintByMap.has(node)) {
			taintByMap.set(node, new Set());
		}
		const taintBy = taintByMap.get(node);
		assert(!taintBy.has(user));
		taintBy.add(user);
	}
	undoTaintForUser(user, node) {
		const {taintMap} = this;
		assert(taintMap.has(user));
		const taintSet = taintMap.get(user);
		assert(taintSet.has(node));
		taintSet.delete(node);
		if (taintSet.size === 0) {
			taintMap.delete(user);
		}
	}
	undoTaintForNode(user, node) {
		const {taintByMap} = this;
		assert(taintByMap.has(node));
		const taintBy = taintByMap.get(node);
		assert(taintBy.has(user));
		taintBy.delete(user);
		if (taintBy.size === 0) {
			taintByMap.delete(node);
		}
	}

	hasTaint(user, node) {
		const {taintMap} = this;
		if (!taintMap.has(user)) {
			return false;
		}
		const taintSet = taintMap.get(user);
		return taintSet.has(node);
	}
	* getTaint(user) {
		const {taintMap} = this;
		if (!taintMap.has(user)) {
			return;
		}
		yield * taintMap.get(user);
	}

	rinseNode(node) {
		const {taintByMap} = this;
		if (!taintByMap.has(node)) {
			return;
		}
		for (const user of taintByMap.get(node)) {
			this.undoTaintForUser(user, node);
		}
		taintByMap.delete(node);
	}

	rinseTill(node, epochNew, rootNew) {
		if (node.getRoot(epochNew, true) === rootNew) {
			return;
		}
		for (const child of node.children) {
			this.rinseTill(child, epochNew, rootNew);
		}
		if (!node.isComponent) {
			this.rinseNode(node);
		}
	}

	rinseUser(user) {
		const {taintMap} = this;
		if (!taintMap.has(user)) {
			return;
		}
		for (const node of taintMap.get(user)) {
			this.undoTaintForNode(user, node);
		}
		taintMap.delete(user);
	}

	replaceTaint(node, nodeNew) {
		const {taintMap, taintByMap} = this;
		if (!taintByMap.has(node)) {
			return;
		}
		const taintBy = taintByMap.get(node);
		taintByMap.delete(node);
		if (!taintByMap.has(nodeNew)) {
			taintByMap.set(nodeNew, taintBy);
		}
		for (const user of taintBy) {
			assert(taintMap.has(user));
			const taintSet = taintMap.get(user);
			assert(taintSet.has(node));
			taintSet.delete(node);
			assert(!taintSet.has(nodeNew));
			taintSet.add(nodeNew);
		}
	}
}

const isSkeleton = (node, epochOld, skeletonExtra) => !node.isAllRemoved && (node.Epoch.lt(epochOld, node.epoch) || skeletonExtra.has(node));

const skeletonIter = function * (root, epochOld, epoch, skeletonExtra, path, regionPredicate, trace = new Map()) {
	assert(isSkeleton(root, epochOld, skeletonExtra));
	skeletonExtra.delete(root);
	if (root.isLeaf) {
		assert(root.data.pk);
		const isInRegion = path.has(root) || regionPredicate(root);
		yield [root, isInRegion, null];
		return;
	}
	const isInSkeleton = root.children.map(child => isSkeleton(child, epochOld, skeletonExtra));
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
		yield * skeletonIter(child, epochOld, epoch, skeletonExtra, path, regionPredicate, trace);
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

const insertPath = (epoch, node, set) => {
	for (const ancestor of node.getPath(epoch)) {
		if (set.has(ancestor)) {
			break;
		}
		set.add(ancestor);
	}
};

import DefaultCrypto from './crypto/DefaultCrypto.js';
import LeftTree from './trees/LeftTree.js';
import PathRegion from './regions/PathRegion.js';

export
const makeTreeKEM = (
	Crypto = DefaultCrypto,
	{
		usingProposal = true,
		usingUnmergedNodes = true,
		usingUnmergedNodesForBlank = usingUnmergedNodes,
		usingUnmergedNodesForSecret = usingUnmergedNodes,
		usingSKE = false,
		usingSKEForPath = usingSKE,
		usingSKEForLeaf = usingSKE,
	} = {},
	RawTreeType = LeftTree,
	RegionTypeEnc = PathRegion, RegionTypeDec = PathRegion,
) => {
	///
///
class TreeType extends RawTreeType {
	constructor(...args) {
		super(...args);

		this.data = {
			pk: null,
			sk: null,
			kk: null,

			unmerged: null,
			recomposed: false,

			sizeBlank: 0,
		};
	}

	get info() {
		return [
			this.data.pk ? '●' : '○',
			this.data.unmerged ? `‣${this.data.unmerged.length}` : '',
			'id' in this.data ? {id: this.data.id} : '',
			...super.info.filter(x => x !== this.data),
		];
	}
}
///
	///
	return (
		///
///
class TreeKEM {
	constructor() {
		this.secret = null;

		const epochInit = new TreeType.Epoch();
		this.tree = new TreeState(epochInit, TreeType);

		this.users = new Map();

		this.regionEnc = new RegionTypeEnc();
		this.regionDec = new RegionTypeDec();
		this.taint = new TaintManager();

		this.skeletonProposal = new Set();
		this.epochCommitted = epochInit;

		this.crypto = new Crypto();
		this.cryptoUser = new Crypto();
	}

	init(ids, a = ids[0]) {
		const n = ids.length;
		const _ = this.tree.init(n);
		for (const leaf of this.tree.root.getLeaves(true)) {
			const i = this.users.size;
			const id = ids[i];
			const [pk, sk] = this.cryptoUser.PKE_Gen(this.cryptoUser.random());
			this.constructor.initData(leaf, id, pk, sk);
			this.users.set(id, leaf);
		}
		assert(this.users.size === n);

		this.commit(a);

		return this._reset();
	}
	static initData(leaf, id, pk, sk = null) {
		leaf.data.id = id;
		leaf.data.pk = pk;
		leaf.data.sk = sk;
	}

	add(a, b, clearingOldNodes = true) {
		assert(this.users.has(a) && !this.users.has(b));
		const ua = this.users.get(a);

		const [_epochOld, treeOld, leafNew] = this.tree.add(ua);

		const [pk, sk] = this.cryptoUser.PKE_Gen(this.cryptoUser.random());
		this.constructor.initData(leafNew, b, pk, sk);
		this.users.set(b, leafNew);

		const skeletonExtra = new Set();

		this.insertSkeleton(skeletonExtra);
		if (!usingProposal) {
			this.commit(a);
		}

		this.taint.rinseTill(treeOld, this.tree.epoch, this.tree.root);
		if (clearingOldNodes) {
			treeOld.clearTill(this.tree.epoch, this.tree.root);
		}

		return clearingOldNodes ? null : treeOld;
	}

	remove(a, b, clearingOldNodes = true) {
		assert(this.users.has(a) && this.users.has(b) && b !== a);
		const ua = this.users.get(a), ub = this.users.get(b);
		this.users.delete(b);

		const [_epochOld, treeOld] = this.tree.remove(ub, ua);

		const skeletonExtra = new Set();
		const {root} = this.tree;
		if (root.epoch !== this.tree.epoch) {
			assert(root.Epoch.lt(root.epoch, this.tree.epoch));
			skeletonExtra.add(root);
		}
		for (const node of this.taint.getTaint(ub)) {
			if (node.getRoot(this.tree.epoch, true) === this.tree.root) {
				insertPath(this.tree.epoch, node, skeletonExtra);
			}
		}
		this.taint.rinseUser(ub);

		this.insertSkeleton(skeletonExtra);
		if (!usingProposal) {
			this.commit(a);
		}

		this.taint.rinseTill(treeOld, this.tree.epoch, this.tree.root);
		if (clearingOldNodes) {
			treeOld.clearTill(this.tree.epoch, this.tree.root);
		}

		return clearingOldNodes ? null : treeOld;
	}

	update(b, a = b, clearingOldNodes = true) {
		assert(this.users.has(a) && this.users.has(b));
		const ua = this.users.get(a), ub = this.users.get(b);

		const [_epochOld, treeOld] = this.tree.update(ub, ua);

		const skeletonExtra = new Set(ub.getPath(this.tree.epoch));
		for (const node of this.taint.getTaint(ub)) {
			if (node.getRoot(this.tree.epoch, true) === this.tree.root) {
				insertPath(this.tree.epoch, node, skeletonExtra);
			} else {
				assert(node.isComponent);
			}
		}

		this.insertSkeleton(skeletonExtra);
		if (!usingProposal) {
			this.commit(a);
		}

		if (this.tree.root === treeOld) {
			return null;
		}
		this.taint.rinseTill(treeOld, this.tree.epoch, this.tree.root);
		if (clearingOldNodes) {
			treeOld.clearTill(this.tree.epoch, this.tree.root);
		}

		return clearingOldNodes ? null : treeOld;
	}

	insertSkeleton(skeleton, filtering = true) {
		if (filtering) {
			for (const node of this.skeletonProposal) {
				if (node.getRoot(this.tree.epoch, true) !== this.tree.root) {
					this.skeletonProposal.delete(node); // safe to delete while iterating `Set`
				}
			}
		}
		if (this.skeletonProposal.size === 0) {
			this.skeletonProposal = skeleton;
			return;
		}
		for (const node of skeleton) {
			this.skeletonProposal.add(node);
		}
	}

	commit(a) {
		if (this.epochCommitted === this.tree.epoch) {
			return;
		}

		assert(this.users.has(a));
		const ua = this.users.get(a);

		///
for (const _ of function * () {
		///
		yield * this.skeletonGen(ua, this.tree.root, this.epochCommitted, this.tree.epoch, this.skeletonProposal);
		///
}.bind(this)()) ;
		///

		this.epochCommitted = this.tree.epoch;
	}

	* skeletonGen(leaf, root, epochOld, epoch, skeletonExtra) {
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
		const seedMap = new Map();
		for (const [node, isInRegion, childTrace] of skeletonIter(root, epochOld, epoch, skeletonExtra, path, regionPredicate, traceOverwrite)) {
			if (node.isLeaf) {
				if (usingSKEForLeaf) {
					this.taint.rinseNode(node);
					node.data.kk = null;
				}
				if (!isInRegion) {
					continue;
				}
				const seed = this.crypto.random();
				let seedNext, secretSKE;
				if (usingSKEForLeaf) {
					[seedNext, secretSKE] = this.crypto.PRG(seed, 2);
					node.data.kk = this.crypto.SKE_Gen(secretSKE);
					if (!path.has(node)) {
						this.taint.taint(leaf, node);
					}
				} else {
					seedNext = seed;
				}
				seedMap.set(node, seedNext);
				assert(node.data.pk);
				yield this.crypto.PKE_Enc(node.data.pk, seed);
				continue;
			}
			assert(childTrace === null || node.children.indexOf(childTrace) >= 0);
			node.data.sizeBlank = sum(node.children.map(child => child.data.sizeBlank), Number(!isInRegion));
			node.data.pk = null;
			node.data.sk = null;
			node.data.kk = null;
			node.data.unmerged = null;
			this.taint.rinseNode(node);
			if (!isInRegion) {
				if (usingUnmergedNodesForBlank) {
					const nodeSecret = recompose(node);
					this.taint.replaceTaint(nodeSecret, node);
					if (node.data.pk) {
						--node.data.sizeBlank;
					}
				}
				continue;
			}
			if (usingUnmergedNodesForSecret) {
				const nodeSecret = recompose(node);
				this.taint.replaceTaint(nodeSecret, node);
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
			let seedNext, secret, secretSKE;
			if (usingSKE && (usingSKEForPath || path.has(node))) {
				[seedNext, secret, secretSKE] = this.crypto.PRG(seed, 3);
				node.data.kk = this.crypto.SKE_Gen(secretSKE);
			} else {
				[seedNext, secret] = this.crypto.PRG(seed, 2);
			}
			seedMap.set(node, seedNext);
			[node.data.pk, node.data.sk] = this.crypto.PKE_Gen(secret);
			if (!path.has(node)) {
				this.taint.taint(leaf, node);
			}
			for (const child of node.children) {
				if (child === childTrace) {
					continue;
				}
				yield * this.skeletonEnc(child, seed, leaf, path);
			}
			for (const leafOther of [ /* hint from `regionDec` */ ]) {
				if (leafOther === leaf) {
					continue;
				}
				const path = new Set(leafOther.getPath(epoch));
				if (path.has(node) || !this.regionDec.isInRegion(node, leafOther, epoch, root, path)) {
					continue;
				}
				assert(leafOther.data.pk);
				this.crypto.PKE_Enc(leafOther.data.pk, seed);
				this.taint.taint(leafOther, node);
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
		if (root.data.pk) {
			if (root.data.kk && (path.has(root) || this.taint.hasTaint(leaf, root))) {
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

	_fill(node = this.tree.root) {
		if (node.isLeaf) {
			return;
		}
		[node.data.pk, node.data.sk] = this.cryptoUser.PKE_Gen(this.cryptoUser.random());
		if (usingSKE) {
			node.data.kk = this.cryptoUser.SKE_Gen(this.cryptoUser.random());
		}
		node.data.sizeBlank = 0;
		this.taint.rinseNode(node);
		for (const child of node.children) {
			this._fill(child);
		}
	}

	_reset() {
		const cryptoOld = this.crypto;
		this.crypto = new Crypto();
		return cryptoOld;
	}

	_noop() {}
}
///
		///
	);
};

export default makeTreeKEM();
