import {assert, range, randint, sum, coalesce, replace, randomChoice} from '../utils.js';
import Epoch, {EpochMap} from '../Epoch.js';
import ChildTree from './persistChildTree.js';

class Tree extends ChildTree {
	static get Epoch() {
		return Epoch;
	}
	get Epoch() {
		return Epoch;
	}

	constructor(epoch, children = [], childTrace = null) {
		super(children);

		this.epoch = epoch;

		this.parentHistory = new EpochMap();
		for (const child of children) {
			child.setParent(epoch, this);
		}

		assert(this.children.every(child => this.Epoch.ge(epoch, child.epoch)));
		if (childTrace === null) {
			assert(this.children.every(child => child.epoch !== epoch));
		} else {
			assert(this.children.includes(childTrace) && childTrace.epoch === epoch);
		}
		this.childTrace = childTrace;

		this.decompose = null;
		this.isComponent = false;

		this.data = {};

		this.debug = randint(1e8);
	}

	* getLeaves(acknowledgingComplexity = false) {
		assert(acknowledgingComplexity, 'O(n) time complexity');
		yield * super.getLeaves();
	}

	getTrace() {
		if (this.childTrace === null) {
			return this;
		}
		return this.childTrace.getTrace();
	}

	setParent(epoch, parent) {
		assert(this.Epoch.ge(epoch, this.epoch), `setting parent for non-descendant epoch ${epoch} ≱ ${this.epoch}`);
		if (parent !== null) {
			assert(epoch === parent.epoch, `set as parent for different epoch ${epoch} ≠ ${parent.epoch}`);
		}
		this.parentHistory.set(epoch, parent);
		return this;
	}
	getParent(epoch) {
		const entry = this.parentHistory.getLowestAncestor(epoch);
		if (!entry) {
			return null;
		}
		const [ , parent] = entry;
		return parent;
	}
	unsetParent(epoch, parent) {
		const deleted = this.parentHistory.delete(epoch);
		assert(deleted === parent);
		return this;
	}

	getRoot(epoch, caching = false) {
		if (caching) {
			if (epoch === this._epochRootCache && this._rootCache !== null) {
				return this._rootCache;
			}
			this._epochRootCache = epoch;
			this._rootCache = null;
		}
		const parent = this.getParent(epoch);
		if (parent === null) {
			if (caching) {
				return (this._rootCache = this);
			}
			return this;
		}
		if (caching) {
			return (this._rootCache = parent.getRoot(epoch, true));
		}
		return parent.getRoot(epoch, false);
	}
	* getPath(epoch, includingSelf = true) {
		if (includingSelf) {
			yield this;
		}
		const parent = this.getParent(epoch);
		if (parent === null) {
			return;
		}
		yield * parent.getPath(epoch);
	}

	getSiblings(epoch) {
		const parent = this.getParent(epoch);
		if (parent === null) {
			return [];
		}
		return replace(parent.children, this);
	}
	* getCopath(epoch) {
		for (const node of this.getPath(epoch)) {
			yield * node.getSiblings(epoch);
		}
	}

	replace(epoch, node, plugin = null) {
		plugin?.align(node, this);
		const parent = this.getParent(epoch);
		if (parent === null) {
			return node;
		}
		const parentNew = new this.constructor(epoch, replace(parent.children, this, node), node);
		return parent.replace(epoch, parentNew, plugin);
	}

	static init(n, epochInit = new this.Epoch()) {
		assert(Number.isInteger(n) && n > 0);
		let epoch = epochInit;
		const leafInit = new this(epoch);
		let root = leafInit;
		for (const _ of range(1, n)) {
			const [epochNew, rootNew] = root.add(epoch, leafInit);
			root.clearTill(epochNew, rootNew);
			[epoch, root] = [epochNew, rootNew];
		}
		return [epoch, root];
	}

	add(_epoch, _node, _hint = null) {
		assert(false, 'abstract add method');
	}

	remove(_epoch, _node, _hint = null) {
		assert(false, 'abstract remove method');
	}

	update(epoch, _node, _hint = null) {
		return [epoch, this];
	}

	clearTill(epochNew, rootNew) {
		this.clearWhen(node => node.getRoot(epochNew, true) !== rootNew);
	}
	clearWhen(predicate) {
		if (!predicate(this)) {
			return;
		}
		for (const child of this.children) {
			child.clearWhen(predicate);
			child.unsetParent(this.epoch, this);
		}
		this.children.length = 0; // clear array
	}

	get info() {
		return [
			this.isComponent ? '※' : '',
			this.decompose ? `⋯${this.decompose.length}` : '',
			`@${this.epoch}`, this.data, `#${this.debug}`,
		];
	}
	print(posList = [], Split = 0.5, Width = 2) {
		/**
		 *
		 * `pos`:
		 * 0. first child
		 * 1. child in middle
		 * 2. last child
		 *
		 */
		const posListPrev = posList.slice(0, -1);
		const posSelf = posList.slice(-1);
		const mid = Math.floor(this.children.length * Split);
		for (const [i, child] of this.children.slice(0, mid).entries()) {
			child.print(posListPrev.concat(
				posSelf.map(pos => pos === 2 ? 1 : pos),
				Number(i > 0),
			), Split, Width);
		}
		/**
		 *
		 * `spread`:
		 * 0. has child on neither side, i.e., leaf
		 * 1. only has child before
		 * 2. only has child after
		 * 3. has child on both sides
		 *
		 */
		const spread = Number(mid > 0) + 2 * Number(mid < this.children.length);
		console.log([
			...posListPrev.map(pos => ' │ '[pos] + Array(Width-1).fill(' ').join('')),
			...posSelf.map(pos => '┌├└'[pos] + Array(Width-1).fill('─').join('')),
			'╼┶┮┾'[spread],
		].join(''), ...this.info.filter(s => (s ?? '') !== ''));
		for (const [i, child] of this.children.slice(mid).entries()) {
			child.print(posListPrev.concat(
				posSelf.map(pos => pos === 0 ? 1 : pos),
				2 - Number(mid + i < this.children.length-1),
			), Split, Width);
		}
	};
}

export
class SparseTree extends Tree {
	constructor(epoch, children, childTrace) {
		super(epoch, children, childTrace);

		if (this.isLeaf) {
			this.sizeLeafRemoved = 0;
			this.firstRemoved = null;
		} else {
			this.sizeLeafRemoved = sum(this.children.map(child => child.sizeLeafRemoved));
			this.firstRemoved = coalesce(this.children.map(child => child.firstRemoved));
		}
		assert((this.sizeLeafRemoved === 0) === (this.firstRemoved === null));
	}
	static newRemoved(epoch) {
		const node = new this(epoch);
		node.sizeLeafRemoved = 1;
		node.firstRemoved = node;
		return node;
	}

	get info() {
		return [this.isAllRemoved ? '∅' : '', ...super.info];
	}

	get isAllRemoved() {
		return this.sizeLeafRemoved === this.sizeLeaf;
	}
	getRandomRemoved() {
		if (this.sizeLeafRemoved === 0) {
			return null;
		} else if (this.sizeLeafRemoved === 1) {
			return this.firstRemoved;
		}
		assert(!this.isLeaf);
		return randomChoice(this.children, 'sizeLeafRemoved', this.sizeLeafRemoved).getRandomRemoved();
	}
	getClosestRemoved(epoch) {
		for (const node of this.getPath(epoch)) {
			if (node.firstRemoved !== null) {
				return node.firstRemoved;
			}
		}
		return null;
	}

	* getSparseLeaves() {
		if (this.isAllRemoved) {
			return;
		}
		if (this.isLeaf) {
			yield this;
			return;
		}
		for (const child of this.children) {
			yield * child.getSparseLeaves();
		}
	}
	* getLeaves(acknowledgingComplexity = false) {
		assert(acknowledgingComplexity, 'O(n) time complexity');
		yield * this.getSparseLeaves();
	}

	add(epoch, leaf, hint = null, randomizing = true) {
		if (this.sizeLeafRemoved === 0) {
			throw new TypeError('generic add method infeasible');
		}
		assert(leaf.isLeaf && leaf.getRoot(epoch) !== this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		const leafRemoved = hint?.getClosestRemoved(epoch) ?? (randomizing ? this.getRandomRemoved() : this.firstRemoved);
		assert(leafRemoved !== null);
		const pluginDecompose = {
			align(nodeNew, node) {
				nodeNew.decompose = [node, leaf];
				node.isComponent = true;
			},
		};
		return [epoch, leafRemoved.replace(epoch, leaf, pluginDecompose)];
	}

	remove(epoch, leaf, _hint = null) {
		assert(leaf.isLeaf && leaf.getRoot(epoch) === this);
		const leafRemoved = this.constructor.newRemoved(epoch);
		return [epoch, leaf.replace(epoch, leafRemoved)];
	}
}

export
const extendBinaryTree = TreeType => (
	///
///
class BinaryTree extends TreeType {
	constructor(epoch, children, childTrace) {
		super(epoch, children, childTrace);
		assert(this.isLeaf || this.children.length === 2);
	}

	get childL() {
		if (this.isLeaf) {
			return null;
		}
		return this.children[0];
	}
	get childR() {
		if (this.isLeaf) {
			return null;
		}
		return this.children[1];
	}

	* split(epoch, node) {
		if (node === this) {
			return;
		}
		for (const sibling of node.getCopath(epoch)) {
			yield sibling;
			if (this.children.includes(sibling)) {
				return;
			}
		}
		assert(false);
	}
	static merge(epoch, roots, order = 0, node = null) {
		if (roots.length === 0) {
			return node;
		}
		const [sibling] = roots.splice(0, 1); // mutate for efficiency
		if (node === null) {
			return this.merge(epoch, roots, order, sibling);
		}
		const children = order ? [node, sibling] : [sibling, node];
		const childTrace = node.epoch === epoch ? node : sibling.epoch === epoch ? sibling : null;
		const nodeNew = new this(epoch, children, childTrace);
		return this.merge(epoch, roots, order, nodeNew);
	}
}
///
	///
);

export
const BinaryTree = extendBinaryTree(Tree);

export
const BinarySparseTree = extendBinaryTree(SparseTree);

export default Tree;
