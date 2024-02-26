import {assert, range, replace} from '../utils.js';
import Tree, {SparseTree} from './baseTree.js';

export
const BTreeEnums = {
	position: [
		'greedy',
		'random',
	],
	remove: [
		'hint-merge-borrow',
		'hint-borrow-merge',
		'merge-borrow',
		'borrow-merge',
		'lazy',
	],
};

export
const makeBTree = (m = 3, position = 'greedy', removeStrategy = 'hint-merge-borrow', plugin = null) => {
	assert(Number.isInteger(m) && m >= 3);
	assert(BTreeEnums.position.includes(position));
	assert(BTreeEnums.remove.includes(removeStrategy));
	const max = m, min = Math.ceil(m / 2);
	const isHintFirst = removeStrategy.startsWith('hint-');
	const isMergeFirst = removeStrategy.endsWith('-borrow');
	const isLazy = removeStrategy === 'lazy';
	const BaseTree = isLazy ? SparseTree : Tree;
	return (
class BTree extends BaseTree {
	constructor(epoch, children, childTrace) {
		super(epoch, children, childTrace);

		if (!this.isLeaf) {
			assert(this.children.length > 1);
			assert(this.children.length <= max);
			for (const child of this.children) {
				assert(child.height === this.height - 1);
				if (!child.isLeaf) {
					assert(child.children.length >= min);
				}
			}
		}
	}

	static init(n, epoch = 0) {
		assert(Number.isInteger(n) && n > 0);
		if (n === 1) {
			return new this(epoch);
		}
		const h = Math.ceil(Math.log(n) / Math.log(max));
		return this.initGivenHeight(epoch, n, h, false);
	}
	static initGivenHeight(epoch, n, h, forcingMin = true) {
		if (n === 1) {
			assert(h === 0);
			return new this(epoch);
		}
		const M = Math.pow(min, h-1);
		if (forcingMin) {
			assert(n >= min * M);
		}
		const k = Math.min(Math.floor(n / M), max);
		const m = Math.floor(n / k), r = n % k;
		const children = Array.from(range(k), i => this.initGivenHeight(epoch, m + Number(i < r), h-1));
		return new this(epoch, children, children[0]); // arbitrary trace
	}

	addSibling(epoch, sibling, nodeReplace = this, nodeDecompose = sibling) {
		const parent = this.getParent(epoch);
		if (parent === null) {
			return new this.constructor(epoch, [nodeReplace, sibling], sibling);
		}
		const peers = replace(parent.children, this, nodeReplace);
		if (peers.length < max) {
			peers.push(sibling);
			const parentNew = new this.constructor(epoch, peers, sibling);
			const pluginDecompose = {
				align(nodeNew, node) {
					plugin?.align(nodeNew, node);
					nodeNew.decompose = [node, nodeDecompose];
					node.isComponent = true;
				},
			};
			return parent.replace(epoch, parentNew, pluginDecompose);
		}
		assert(peers.length === max);
		if (max % 2 === 1 && nodeReplace === peers[min-1]) {
			peers.splice(min-1, 1);
			peers.push(nodeReplace);
		}
		let peersStay, peersMove;
		if (peers.indexOf(nodeReplace) >= min) {
			peersStay = peers.slice(0, min);
			peersMove = peers.slice(min);
		} else {
			peersMove = peers.slice(0, -min);
			peersStay = peers.slice(-min);
		}
		peersMove.push(sibling);
		const parentNew = new this.constructor(epoch, peersStay, null);
		plugin?.align(parentNew, parent);
		const nodeNew = new this.constructor(epoch, peersMove, sibling);
		plugin?.align(nodeNew, parent);
		return parent.addSibling(epoch, nodeNew, parentNew, nodeDecompose);
	}

	removeSelf(epoch, hint = null, siblingToReplace = null, nodeReplace = null) {
		const parent = this.getParent(epoch);
		if (parent === null) {
			assert(false, 'attempting to remove the last node');
		}
		const peers = siblingToReplace === null ? parent.children : replace(parent.children, siblingToReplace, nodeReplace);
		const siblings = replace(peers, this);
		const grandparent = parent.getParent(epoch);
		if (grandparent === null && siblings.length === 1) {
			const sibling = siblings[0];
			assert(nodeReplace === null || sibling === nodeReplace);
			if (sibling.epoch < epoch) {
				sibling.setParent(epoch, null);
			}
			return sibling;
		} else if (grandparent === null || siblings.length >= min) {
			const parentNew = new this.constructor(epoch, siblings, nodeReplace);
			return parent.replace(epoch, parentNew, plugin);
		}
		assert(siblings.length === min-1);
		const parentSiblings = parent.getSiblings(epoch);
		const hintParent = hint?.getParent(epoch);
		assert((hint === null) === (hintParent === null));
		let parentSibling = null, merging = null;
		if (isHintFirst && parentSiblings.includes(hintParent)) {
			parentSibling = hintParent;
			if (isMergeFirst) {
				merging = hintParent.children.length <= max - min + 1;
			} else {
				merging = !(hintParent.children.length > min);
			}
		} else {
			for (const parentSiblingTry of parentSiblings) {
				if (isMergeFirst && parentSiblingTry.children.length <= max - min + 1) {
					parentSibling = parentSiblingTry;
					merging = true;
					break;
				} else if (!isMergeFirst && parentSiblingTry.children.length > min) {
					parentSibling = parentSiblingTry;
					merging = false;
					break;
				}
			}
			if (parentSibling === null) {
				parentSibling = parentSiblings[0]; // arbitrary sibling
				merging = !isMergeFirst;
			}
		}
		assert(parentSibling !== null);
		if (!merging) {
			assert(parentSibling.children.length > min);
			let cousinsStay, cousinsMove;
			if (parentSibling === hintParent) {
				const i = hintParent.children.indexOf(hint);
				assert(i >= 0);
				const l = hintParent.children.length;
				if (i >= min) {
					cousinsStay = hintParent.children.slice(0, min);
					cousinsMove = hintParent.children.slice(min);
				} else if (i < l - min) {
					cousinsMove = hintParent.children.slice(0, -min);
					cousinsStay = hintParent.children.slice(-min);
				} else {
					cousinsStay = replace(hintParent.children, hint);
					cousinsMove = [hint];
				}
			} else {
				cousinsStay = parentSibling.children.slice(0, min);
				cousinsMove = parentSibling.children.slice(min);
			}
			const siblingsNew = [].concat(cousinsMove, siblings);
			const parentNew = new this.constructor(epoch, siblingsNew, nodeReplace);
			plugin?.align(parentNew, parentSibling);
			const parentSiblingNew = new this.constructor(epoch, cousinsStay, null);
			plugin?.align(parentSiblingNew, parentSibling);
			const parentPeers = replace(replace(grandparent.children, parent, parentNew), parentSibling, parentSiblingNew);
			const grandparentNew = new this.constructor(epoch, parentPeers, parentNew);
			return grandparent.replace(epoch, grandparentNew, plugin);
		}
		assert(parentSibling.children.length <= max - min + 1);
		const cousinsNew = [].concat(parentSibling.children, siblings);
		const parentSiblingNew = new this.constructor(epoch, cousinsNew, nodeReplace);
		plugin?.align(parentSiblingNew, parentSibling);
		parentSiblingNew.decompose = [parentSibling, ...siblings];
		parentSibling.isComponent = true;
		return parent.removeSelf(epoch, hintParent, parentSibling, parentSiblingNew);
	}

	add(epoch, leaf, hint = null) {
		assert(/* leaf.isLeaf && */ leaf.getRoot(epoch) !== this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		if (isLazy && this.sizeLeafRemoved > 0) {
			return super.add(epoch, leaf, hint);
		}
		let sibling;
		switch (position) {
			case 'greedy': {
				sibling = hint ?? this.getRandomLeaf();
			} break;
			case 'random': {
				sibling = this.getRandomLeaf();
			} break;
		}
		return sibling.addSibling(epoch, leaf);
	}

	remove(epoch, leaf, hint = null) {
		assert(/* leaf.isLeaf && */ leaf.getRoot(epoch) === this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		if (isLazy) {
			return super.remove(epoch, leaf);
		}
		return leaf.removeSelf(epoch, hint);
	}
}
	);
};

export
const make23Tree = (...options) => makeBTree(3, ...options);
export
const make234Tree = (...options) => makeBTree(4, ...options);

export
const $23Tree = make23Tree();
export
const $234Tree = make234Tree();

export default makeBTree();
