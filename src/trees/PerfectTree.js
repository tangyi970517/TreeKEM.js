import {assert} from '../utils.js';
import {LeftTreeEnums, makeLeftTree} from './LeftTree.js';

export
const PerfectTreeEnums = {
	position: LeftTreeEnums.position.filter(p => p !== 'append'),
	truncate: LeftTreeEnums.truncate.filter(t => t !== 'balance'),
};

export
const makePerfectTree = (position = 'greedy', truncate = 'truncate') => {
	assert(LeftTreeEnums.position.includes(position));
	assert(LeftTreeEnums.truncate.includes(truncate));
	const LeftTree = makeLeftTree(position, truncate);
	return (
		///
///
class PerfectTree extends LeftTree {
	constructor(epoch, children, childTrace) {
		super(epoch, children, childTrace);
		assert(this.isPerfect);
	}

	static initLeft(epoch, n) {
		const H = Math.ceil(Math.log2(n)), N = Math.pow(2, H);
		return this.initPerfect(epoch, H, N - n);
	}
	static initPerfect(epoch, h, nRemoved = 0) {
		if (nRemoved === 0) {
			return super.initPerfect(epoch, h);
		}
		if (h === 0) {
			assert(nRemoved === 1);
			return this.newRemoved(epoch);
		}
		const nHalf = Math.pow(2, h-1);
		const children = [
			this.initPerfect(epoch, h-1, Math.max(0, nRemoved - nHalf)),
			this.initPerfect(epoch, h-1, Math.min(nRemoved, nHalf)),
		];
		return new this(epoch, children, children[0]);
	}

	pad(epoch, leaf, h) {
		let node = leaf;
		for (let i = 0, n = 1; i < h; ++i, n *= 2) {
			const nodeRight = this.constructor.initPerfect(epoch, i, n);
			node = new this.constructor(epoch, [node, nodeRight], node);
		}
		return node;
	}
	append(epoch, leaf) {
		assert(this.isPerfect);
		const nodeRight = this.pad(epoch, leaf, this.height);
		return new this.constructor(epoch, [this, nodeRight], nodeRight);
	}

	truncate(epoch) {
		if (this.isAllRemoved) {
			return null;
		}
		if (this.isLeaf) {
			return this;
		}
		if (!this.rawR.isAllRemoved) {
			return this;
		}
		return this.rawL.truncate(epoch);
	}
}
///
		///
	);
};

export default makePerfectTree();
