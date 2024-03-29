import {assert} from '../utils.js';
import {BinaryTree, BinarySparseTree} from './baseTree.js';
import {BTreeEnums, makeBTree} from './BTree.js';

export
const LLRBTreeEnums = {
	mode: [
		'normal',
		'2-3',
	],
	...BTreeEnums,
};

export
const BTreePluginLLRB = {
	align(nodeNew, nodeOld) {
		if (nodeNew.isLeaf || nodeOld.isLeaf) {
			return;
		}
		const matchLL = nodeNew.children[0] === nodeOld.children[0] && nodeNew.children[1] === nodeOld.children[1];
		const matchLR = nodeOld.children.length === 4 && nodeNew.children[0] === nodeOld.children[2] && nodeNew.children[1] === nodeOld.children[3];
		const matchRL = nodeNew.children.length === 4 && nodeNew.children[2] === nodeOld.children[0] && nodeNew.children[3] === nodeOld.children[1];
		const matchRR = nodeNew.children.length === 4 && nodeOld.children.length === 4 && nodeNew.children[2] === nodeOld.children[2] && nodeNew.children[3] === nodeOld.children[3];
		switch (nodeNew.children.length) {
			case 4: {
				switch (nodeOld.children.length) {
					case 4: if (matchRR) {
						nodeNew.RR = nodeOld.RR;
					} // fall-through falls through! // break;
					case 3: if (matchRL) {
						nodeNew.RR = nodeOld.RL;
					} break;
					case 2: if (matchRL) {
						nodeNew.RR = nodeOld.RB;
					} break;
				}
			} // fall-through falls through! // break;
			case 3: {
				switch (nodeOld.children.length) {
					case 4: if (matchLR) {
						nodeNew.RL = nodeOld.RR;
					} // fall-through falls through! // break;
					case 3: if (matchLL) {
						nodeNew.RL = nodeOld.RL;
					} break;
					case 2: if (matchLL) {
						nodeNew.RL = nodeOld.RB;
					} break;
				}
			} break;
			case 2: {
				switch (nodeOld.children.length) {
					case 4: if (matchLR) {
						nodeNew.RB = nodeOld.RR;
					} // fall-through falls through! // break;
					case 3: if (matchLL) {
						nodeNew.RB = nodeOld.RL;
					} break;
					case 2: if (matchLL) {
						nodeNew.RB = nodeOld.RB;
					} break;
				}
			} break;
		}
	}
};

export
const makeLLRBTree = (mode = 'normal', position = 'greedy', removeStrategy = 'hint-merge-borrow') => {
	assert(LLRBTreeEnums.mode.includes(mode));
	assert(LLRBTreeEnums.position.includes(position));
	assert(LLRBTreeEnums.remove.includes(removeStrategy));
	const m = mode === '2-3' ? 3 : 4;
	const removeStrategyNonlazy = {'lazy': 'hint-merge-borrow'}[removeStrategy] ?? removeStrategy;
	///
///
class BTree extends makeBTree(m, position, removeStrategyNonlazy, BTreePluginLLRB) {
	constructor(epoch, children, childTrace) {
		super(epoch, children, childTrace);
		this.RB = null;
		this.RL = null;
		this.RR = null;
	}
}
///
	///
	const isLazy = removeStrategy === 'lazy';
	const BaseTree = isLazy ? BinarySparseTree : BinaryTree;
	return (
		///
///
class LLRBTree extends BaseTree {
	constructor(epoch, children, childTrace) {
		super(epoch, children, childTrace);

		this.B = null;

		this.colorPattern = '♣\ufe0f♠\ufe0f'; // for fun
	}

	get info() {
		return [this.colorPattern, ...super.info];
	}

	static isomorph(epoch, node) {
		if (node.RB !== null) {
			const nodeRB = node.RB;
			nodeRB.B = node; // even overwrite!
			return nodeRB;
		}
		const children = node.children.map(child => this.isomorph(epoch, child));
		let indexTrace = NaN, childTrace = null;
		let indexTraceOther = NaN, childTraceOther = null;
		for (const [i, child] of children.entries()) {
			if (child.epoch === epoch) {
				if (node.children[i] === node.childTrace) {
					indexTrace = i;
					childTrace = child;
				} else {
					indexTraceOther = i;
					childTraceOther = child;
				}
			}
		}
		if (childTrace === null && childTraceOther !== null) {
			indexTrace = indexTraceOther;
			childTrace = childTraceOther;
		}
		assert(!(childTrace !== null && node.childTrace === null));
		let nodeRB;
		switch (children.length) {
			case 0: {
				nodeRB = new this(epoch);
				nodeRB.colorPattern = '';
			} break;
			case 2: {
				nodeRB = new this(epoch, children, childTrace);
			} break;
			case 3:
			case 4: {
				let nodeL, traceL = null;
				if (node.RL !== null) {
					assert(node.RL.children[0] === children[0] && node.RL.children[1] === children[1]);
					assert(!(indexTrace < 2));
					nodeL = node.RL;
				} else {
					const childTraceL = indexTrace < 2 ? childTrace : children[0].epoch === epoch ? children[0] : children[1].epoch === epoch ? children[1] : null;
					nodeL = new this(epoch, children.slice(0, 2), childTraceL);
					traceL = nodeL;
					node.RL = nodeL;
				}
				if (children.length === 3) {
					const childTrace3 = indexTrace >= 2 ? childTrace : traceL;
					nodeRB = new this(epoch, [nodeL, children[2]], childTrace3);
					nodeRB.colorPattern = '♦\ufe0f♣\ufe0f';
					break;
				}
				let nodeR, traceR = null;
				if (node.RR !== null) {
					assert(node.RR.children[0] === children[2] && node.RR.children[1] === children[3]);
					assert(!(indexTrace >= 2));
					nodeR = node.RR;
				} else {
					const childTraceR = indexTrace >= 2 ? childTrace : children[2].epoch === epoch ? children[2] : children[3].epoch === epoch ? children[3] : null;
					nodeR = new this(epoch, children.slice(2), childTraceR);
					traceR = nodeR;
					node.RR = nodeR;
				}
				const childTrace4 = indexTrace >= 2 ? nodeR : (traceL ?? traceR);
				nodeRB = new this(epoch, [nodeL, nodeR], childTrace4);
				nodeRB.colorPattern = '♥\ufe0f♦\ufe0f';
			} break;
			default: {
				assert(false);
			}
		}
		nodeRB.B = node;
		if (node.decompose) {
			assert(node.decompose[0].isComponent);
			const decompose = node.decompose.map(node => node.RB);
			assert(decompose.every(Boolean));
			if (!nodeRB.children.includes(decompose[0])) {
				decompose[0].isComponent = true;
				nodeRB.decompose = decompose;
			}
		}
		return (node.RB = nodeRB);
	}

	static init(n, epoch = new this.Epoch()) {
		const [epochNew, root] = BTree.init(n, epoch);
		return [epochNew, this.isomorph(epochNew, root)];
	}

	add(epoch, leaf, hint = null) {
		const leafB = new BTree(epoch);
		leaf.B = leafB;
		leafB.RB = leaf;
		leaf.colorPattern = '';
		if (isLazy && this.sizeLeafRemoved > 0) {
			return super.add(epoch, leaf, hint);
		}
		const [epochNew, BNew] = this.B.add(epoch, leafB, hint?.B);
		return [epochNew, this.constructor.isomorph(epochNew, BNew)];
	}

	remove(epoch, leaf, hint = null) {
		if (isLazy) {
			return super.remove(epoch, leaf);
		}
		const [epochNew, BNew] = this.B.remove(epoch, leaf.B, hint?.B);
		const RBNew = this.constructor.isomorph(epochNew, BNew);
		if (RBNew.epoch !== epochNew) {
			assert(this.Epoch.lt(RBNew.epoch, epochNew));
			RBNew.setParent(epochNew, null);
		}
		return [epochNew, RBNew];
	}

	clearTill(epochNew, rootNew) {
		if (this.getRoot(epochNew, true) === rootNew) {
			return;
		}
		if (this.B !== null) {
			assert(rootNew.B !== null);
			this.B.clearTill(epochNew, rootNew.B);
			this.B = null;
		}
		super.clearTill(epochNew, rootNew);
	}
}
///
		///
	);
};

export default makeLLRBTree();
