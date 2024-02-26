import {assert, range, randint, sum, coalesce, replace, randomChoice} from '../utils.js';
import ChildTree from './persistChildTree.js';

class Tree extends ChildTree {
	constructor(epoch, children = [], childTrace = null) {
		super(children);

		this.epoch = epoch;

		this.parentHistory = [[-Infinity, null]];
		for (const child of children) {
			child.setParent(epoch, this);
		}

		if (childTrace === null) {
			assert(this.children.every(child => child.epoch < epoch));
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

	/**
	 *
	 * binary search for the last `<= epoch` index
	 * - optimize by searching from the end in the meanwhile, to accelerate the most common use cases
	 *   (e.g. inserting/finding the latest epoch)
	 *
	 */
	indexOfEpoch(epoch) {
		let l = 0, r = this.parentHistory.length;
		let i = this.parentHistory.length-1;
		while (l + 1 < r) {
			const m = l + Math.floor((r - l) / 2); // r - l > 1, so >= 2
			if (this.parentHistory[m][0] <= epoch) {
				l = m;
			} else {
				r = m;
			}
			assert(i >= 0);
			if (this.parentHistory[i][0] <= epoch) {
				return i;
			}
			--i;
		}
		return l;
	}
	setParent(epoch, parent) {
		assert(epoch >= this.epoch, `setting parent for early epoch ${epoch} < ${this.epoch}`);
		if (parent !== null) {
			assert(epoch === parent.epoch, `set as parent for different epoch ${epoch} ≠ ${parent.epoch}`);
		}
		const i = this.indexOfEpoch(epoch);
		this.parentHistory.splice(i+1, 0, [epoch, parent]);
		return this;
	}
	getParent(epoch) {
		if (this.parentHistory.length === 0) {
			return null;
		}
		return this.parentHistory[this.indexOfEpoch(epoch)][1];
	}
	unsetParent(epoch, parent) {
		const iLast = this.indexOfEpoch(epoch);
		for (let i = iLast; i >= 0; --i) {
			const [e, p] = this.parentHistory[i];
			if (e < epoch) {
				break;
			}
			if (p === parent) {
				this.parentHistory.splice(i, 1);
				return this;
			}
		}
		assert(false);
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
		return parent.replace(epoch, parentNew);
	}

	static init(n, epochInit = 0) {
		assert(Number.isInteger(n) && n > 0);
		const leafInit = new this(epochInit - (n-1));
		let root = leafInit;
		for (const i of range(1, n)) {
			const epoch = epochInit - (n-1 - i);
			root = root.add(epoch, new this(epoch), leafInit);
		}
		return root;
	}

	add(_epoch, _node, _hint = null) {
		assert(false, 'abstract add method');
	}

	remove(_epoch, _node, _hint = null) {
		assert(false, 'abstract remove method');
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
		this.decompose = null;
	}

	get info() {
		return [this.epoch, this.data, this.debug];
	}
	print(hasNextList = [], Width = 2) {
		console.log([
			...hasNextList.slice(0, -1).map(hasNext => (hasNext ? '│' : ' ') + Array(Width-1).fill(' ').join('')),
			...hasNextList.slice(-1).map(hasNextSelf => (hasNextSelf ? '├' : '└') + Array(Width-1).fill('─').join('')),
			this.children.length > 0 ? '┮' : '╼',
		].join(''), ...this.info);
		for (const [i, child] of this.children.entries()) {
			child.print(hasNextList.concat(i < this.children.length-1), Width);
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
		}
		if (this.isLeaf) {
			return this;
		}
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

	add(epoch, leaf, hint = null) {
		if (this.sizeLeafRemoved === 0) {
			throw new TypeError('generic add method infeasible');
		}
		assert(leaf.isLeaf && leaf.getRoot(epoch) !== this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		const leafRemoved = hint?.getClosestRemoved(epoch) ?? this.getRandomRemoved();
		assert(leafRemoved !== null);
		const pluginDecompose = {
			align(nodeNew, node) {
				nodeNew.decompose = [node, leaf];
				node.isComponent = true;
			},
		};
		return leafRemoved.replace(epoch, leaf, pluginDecompose);
	}

	remove(epoch, leaf, _hint = null) {
		assert(leaf.isLeaf && leaf.getRoot(epoch) === this);
		const leafRemoved = this.constructor.newRemoved(epoch);
		return leaf.replace(epoch, leafRemoved);
	}
}

export
const extendBinaryTree = TreeType => (
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
}
);

export
const BinaryTree = extendBinaryTree(Tree);

export
const BinarySparseTree = extendBinaryTree(SparseTree);

export default Tree;
