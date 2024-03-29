import {assert, randint} from '../utils.js';
import {BinaryTree, BinarySparseTree} from './baseTree.js';

export
const LeftTreeEnums = {
	position: [
		'greedy',
		'random',
		'random+append',
		'leftmost',
		'append',
	],
	truncate: [
		'balance',
		'truncate',
		'keep',
	],
};

export
const makeLeftTree = (position = 'greedy', truncate = 'truncate') => {
	assert(LeftTreeEnums.position.includes(position));
	assert(LeftTreeEnums.truncate.includes(truncate));
	const isLazy = truncate !== 'balance';
	const BaseTree = isLazy ? BinarySparseTree : BinaryTree;
	return (
		///
///
class LeftTree extends BaseTree {
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

	static init(n, epoch = new this.Epoch()) {
		assert(Number.isInteger(n) && n > 0);
		return [epoch, this.initLeft(epoch, n)];
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
		const rootNew = new this.constructor(epoch, [this.rawL, childNew], childNew);
		rootNew.decompose = [this, leaf];
		this.isComponent = true;
		return rootNew;
	}

	getRightPerfect() {
		assert(!this.isPerfect);
		if (this.rawR.isPerfect) {
			return this.rawR;
		}
		return this.rawR.getRightPerfect();
	}
	pop(epoch, leaf) {
		const path = [...leaf.getPath(epoch)];
		const indexPerfect = path.findLastIndex(node => node.isPerfect);
		const nodePerfect = path[indexPerfect];
		const nodeImperfect = indexPerfect < path.length-1 ? path[indexPerfect+1] : null;
		if (nodePerfect === leaf) {
			if (nodeImperfect === null) {
				assert(false, 'attempting to remove the last node');
			}
			assert(nodePerfect === nodeImperfect.rawR);
			const parent = nodeImperfect.getParent(epoch);
			if (parent === null) {
				return nodeImperfect.rawL.setParent(epoch, null);
			}
			assert(nodeImperfect === parent.rawR);
			const parentNew = new this.constructor(epoch, [parent.rawL, nodeImperfect.rawL], null);
			return parent.replace(epoch, parentNew);
		}
		const split = [...nodePerfect.split(epoch, leaf)];
		if (nodeImperfect === null || nodePerfect === nodeImperfect.rawR) {
			if (split.length === 1) {
				if (nodeImperfect === null) {
					return split[0].setParent(epoch, null);
				}
				const nodeImperfectNew = new this.constructor(epoch, [nodeImperfect.rawL, split[0]], null);
				return nodeImperfect.replace(epoch, nodeImperfectNew);
			}
			return nodePerfect.replace(epoch, this.constructor.merge(epoch, split));
		}
		const nodeRight = nodeImperfect.rawR;
		const nodeRightPerfect = nodeImperfect.getRightPerfect();
		if (nodeRightPerfect === nodeRight && nodeRightPerfect.height === 0) {
			split.unshift(nodeRightPerfect); // mutate for efficiency
			return nodeImperfect.replace(epoch, this.constructor.merge(epoch, split));
		}
		const splitRight = nodeRightPerfect !== nodeRight ? [...nodeRight.split(epoch, nodeRightPerfect)] : [];
		const indexRightPerfect = split.findIndex(node => node.height === nodeRightPerfect.height);
		assert(indexRightPerfect >= 0);
		assert((indexRightPerfect === 0) === (nodeRightPerfect.height === 0));
		const splitShift = split.splice(0, indexRightPerfect, nodeRightPerfect); // mutate for efficiency
		const nodePerfectNew = this.constructor.merge(epoch, split);
		splitRight.unshift(...splitShift); // mutate for efficiency
		const nodeRightNew = this.constructor.merge(epoch, splitRight);
		const nodeImperfectNew = new this.constructor(epoch, [nodePerfectNew, nodeRightNew], nodePerfectNew);
		return nodeImperfect.replace(epoch, nodeImperfectNew);
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
				if (this.sizeLeafRemoved > 0) {
					return super.add(epoch, leaf, null);
				}
			} break;
			case 'random+append': {
				if (this.sizeLeafRemoved > 0 && randint(this.sizeLeafRemoved+1) > 0) { // +1 for the chance to append
					return super.add(epoch, leaf, null);
				}
			} break;
			case 'leftmost': {
				if (this.sizeLeafRemoved > 0) {
					return super.add(epoch, leaf, null, false);
				}
			} break;
		}
		return [epoch, this.append(epoch, leaf)];
	}

	remove(epoch, leaf, _hint) {
		assert(leaf.isLeaf && leaf.getRoot(epoch) === this);
		switch (truncate) {
			case 'balance': {
				return [epoch, this.pop(epoch, leaf)];
			} break;
			case 'truncate': {
				const [epochNew, rootNew] = super.remove(epoch, leaf);
				const epochNext = epochNew.step();
				const rootTruncate = rootNew.truncate(epochNext);
				if (rootTruncate === null) {
					assert(false, 'attempting to remove the last node');
				}
				if (rootTruncate.epoch !== epochNext) {
					assert(this.Epoch.lt(rootTruncate.epoch, epochNext));
					rootTruncate.setParent(epochNext, null);
				}
				if (rootTruncate !== rootNew) {
					rootNew.clearWhen(node => node.epoch === epochNew && node.getRoot(epochNew, true) === rootNew);
				}
				return [epochNext, rootTruncate];
			} break;
			case 'keep': {
				return super.remove(epoch, leaf);
			} break;
		}
	}
}
///
		///
	);
};

export default makeLeftTree();
