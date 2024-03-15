import {assert, range} from '../utils.js';
import {BinaryTree, BinarySparseTree} from './baseTree.js';

export
const SplayTreeEnums = {
	add: [
		'append',
		'splay',
	],
	remove: [
		'splay',
		'lazy',
	],
	update: [
		'splay',
		'ignore',
	],
};

import LeftTree from './LeftTree.js';

export
const makeSplayTree = (removeStrategy = 'splay', addStrategy = 'append', updateStrategy = 'splay') => {
	assert(SplayTreeEnums.add.includes(addStrategy));
	assert(SplayTreeEnums.remove.includes(removeStrategy));
	assert(SplayTreeEnums.update.includes(updateStrategy));
	const isLazy = removeStrategy === 'lazy';
	const BaseTree = isLazy ? BinarySparseTree : BinaryTree;
	const ignoringAdd = updateStrategy === 'append';
	const ignoringUpdate = updateStrategy === 'ignore';
	return (
		///
///
class SplayTree extends BaseTree {
	// default constructor

	static init(n, epoch = new this.Epoch()) {
		const [epochNew, root] = LeftTree.init(n, epoch);
		return [epochNew, this.initCopy(epochNew, root)];
	}
	static initCopy(epoch, root) {
		if (root.isLeaf) {
			return new this(epoch);
		}
		const children = root.children.map(child => this.initCopy(epoch, child));
		return new this(epoch, children, children[0]); // arbitrary trace
	}

	static merge2(epoch, roots, order = 0) {
		const rootsNew = Array(Math.ceil(roots.length / 2));
		for (const i of range(Math.floor(roots.length / 2))) {
			rootsNew[i] = this.merge(epoch, roots.slice(i*2, i*2+2), order);
		}
		if (roots.length % 2) {
			rootsNew[rootsNew.length-1] = roots[roots.length-1];
		}
		return this.merge(epoch, rootsNew, order);
	}
	splayWithHint(epoch, node, hint = null, removing = false, completing = true) {
		const copath = [...this.split(epoch, node)];
		if (removing) {
			if (copath.length === 0) {
				assert(false, 'attempting to remove the last node');
			}
		} else {
			copath.unshift(node); // mutate for efficiency
		}
		if (hint !== null) {
			const copathMap = new Map(copath.map((node, i) => [node, i]));
			let found = false;
			for (const ancestor of hint.getPath(epoch)) {
				if (!copathMap.has(ancestor)) {
					continue;
				}
				const i = copathMap.get(ancestor);
				copath.copyWithin(1, 0, i);
				copath[0] = ancestor;
				found = true;
				break;
			}
			assert(found);
		}
		const rootNew = this.constructor.merge2(epoch, copath);
		if (completing && rootNew.epoch !== epoch) {
			assert(this.Epoch.lt(rootNew.epoch, epoch));
			rootNew.setParent(epoch, null);
		}
		return rootNew;
	}

	add(epoch, leaf, hint = null) {
		assert(/* leaf.isLeaf && */ leaf.getRoot(epoch) !== this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		if (isLazy && this.sizeLeafRemoved > 0) {
			return super.add(epoch, leaf, hint);
		}
		let rootNew;
		if (ignoringAdd || hint === null) {
			rootNew = this;
		} else {
			rootNew = this.splayWithHint(epoch, hint, hint, false, false);
		}
		return [epoch, new this.constructor(epoch, [rootNew, leaf], leaf)];
	}

	remove(epoch, leaf, hint = null) {
		assert(/* leaf.isLeaf && */ leaf.getRoot(epoch) === this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		if (isLazy) {
			return super.remove(epoch, leaf);
		}
		return [epoch, this.splayWithHint(epoch, leaf, hint, true)];
	}

	update(epoch, leaf, hint = null) {
		assert(/* leaf.isLeaf && */ leaf.getRoot(epoch) === this);
		assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
		if (ignoringUpdate) {
			return super.update(epoch, leaf, hint);
		}
		return [epoch, this.splayWithHint(epoch, leaf, hint)];
	}
}
///
		///
	);
};

export default makeSplayTree();
