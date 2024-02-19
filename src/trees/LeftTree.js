import {assert, randint} from '../utils.js';
import {BinaryTree} from './baseTree.js';

export
const LeftTreeEnums = {
	position: [
		'greedy',
		'random',
		'append',
	],
	truncate: [
		'truncate',
		'keep',
	],
};

export
const makeLeftTree = (position = 'greedy', truncate = 'truncate') => {
	assert(LeftTreeEnums.position.includes(position));
	assert(LeftTreeEnums.truncate.includes(truncate));
	return (

/**
 *
 * left-balanced binary tree:
 * - left child is *perfect* binary tree,
 * - right child is recursively left-balanced binary tree,
 * - height of left child is no less than height of right child
 *
 * Fact.
 * [#leaf in perfect binary tree] = 2^floor(log2[#leaf])
 *
 */
class LeftTree extends BinaryTree {
	constructor(epoch, children, childTrace) {
		super(epoch, children, childTrace);

		this.rawL = this.childL;
		this.rawR = this.childR;

		if (this.isLeaf) {
			this.isPerfect = true;
		} else {
			assert(this.rawL.isPerfect);
			assert(this.rawR.height <= this.rawL.height);
			this.isPerfect = this.rawR.isPerfect && this.rawR.height === this.rawL.height;
		}
	}

	static init(n, epoch = 0) {
		assert(Number.isInteger(n) && n > 0);
		return this.initLeft(epoch, n);
	}
	static initLeft(epoch, n) {
		if (n === 1) {
			return new this(epoch);
		}
		const h = Math.floor(Math.log2(n)), nL = Math.pow(2, h);
		if (nL === n) {
			return this.initPerfect(epoch, h);
		}
		assert(nL < n);
		const children = [
			this.initPerfect(epoch, h),
			this.initLeft(epoch, n - nL),
		];
		return new this(epoch, children, children[0]); // arbitrary trace
	}
	static initPerfect(epoch, h) {
		if (h === 0) {
			return new this(epoch);
		}
		const children = [
			this.initPerfect(epoch, h-1),
			this.initPerfect(epoch, h-1),
		];
		return new this(epoch, children, children[0]); // arbitrary trace
	}

	append(epoch, leaf) {
		if (this.isPerfect) {
			return new this.constructor(epoch, [this, leaf], leaf);
		}
		const childNew = this.rawR.append(epoch, leaf);
		return new this.constructor(epoch, [this.rawL, childNew], childNew);
	}

	truncate(epoch) {
		if (this.isAllRemoved) {
			return null;
		}
		if (this.isLeaf) {
			return this;
		}
		const childNew = this.rawR.truncate(epoch);
		if (childNew !== null) {
			if (childNew === this.rawR) {
				return this;
			}
			const childTrace = childNew.epoch === epoch ? childNew : null;
			return new this.constructor(epoch, [this.rawL, childNew], childTrace);
		}
		return this.rawL.truncate(epoch);
	}

	add(epoch, leaf, hint = null) {
		assert(leaf.isLeaf && leaf.getRoot(epoch) !== this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		switch (position) {
			case 'greedy': {
				if (this.sizeLeafRemoved > 0) {
					return super.add(epoch, leaf, hint);
				}
			} break;
			case 'random': {
				if (this.sizeLeafRemoved > 0 && randint(this.sizeLeafRemoved+1) > 0) { // +1 for the chance to append
					return super.add(epoch, leaf, null);
				}
			} break;
		}
		return this.append(epoch, leaf);
	}

	remove(epoch, leaf, _hint) {
		assert(leaf.isLeaf && leaf.getRoot(epoch) === this);
		const rootNew = super.remove(epoch, leaf);
		switch (truncate) {
			case 'truncate': {
				const rootTruncate = rootNew.truncate(epoch);
				assert(rootTruncate !== null, 'attempting to remove the last node');
				if (rootTruncate.epoch < epoch) {
					rootTruncate.setParent(epoch, null);
				}
				return rootTruncate;
			} break;
			case 'keep': {
				return rootNew;
			} break;
		}
	}
}
	);
};

export default makeLeftTree();
