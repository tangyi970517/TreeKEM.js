import {assert, binary_search_last} from '../utils.js';

class ParentTree {
	constructor(parent = null) {
		if (parent === null) {
			this.depth = 0;
			this.ancestors = [];
		} else {
			this.depth = parent.depth + 1;
			const jumps = Math.floor(Math.log2(this.depth)) + 1;
			this.ancestors = Array(jumps).fill(null);
			this.ancestors[0] = parent;
		}

		if (parent !== null) {
			this.index = parent.childCount;
			++parent.childCount;
		}
		this.childCount = 0;
	}

	getJump(jump) {
		assert(jump < this.ancestors.length);
		if (this.ancestors[jump] !== null) {
			return this.ancestors[jump];
		}
		const ancestor = this.getJump(jump-1).getJump(jump-1);
		return (this.ancestors[jump] = ancestor);
	}

	getAncestor(depth) {
		if (depth === this.depth) {
			return this;
		}
		assert(depth < this.depth);
		const jump = Math.floor(Math.log2(this.depth - depth));
		return this.getJump(jump).getAncestor(depth);
	}

	static LCA(a, b, jumpHint = Infinity) {
		if (a.depth != b.depth) {
			const depth = Math.min(a.depth, b.depth);
			return this.LCA(a.getAncestor(depth), b.getAncestor(depth));
		}
		if (a === b) {
			return a;
		}
		const jumps = a.ancestors.length;
		assert(jumps === b.ancestors.length);
		assert(jumps >= 1, 'common ancestor not found');
		if (a.getJump(0) === b.getJump(0)) {
			return a.ancestors[0];
		}
		const i = binary_search_last(Math.min(jumpHint, jumps), i => a.getJump(i) !== b.getJump(i));
		assert(i >= 0);
		return this.LCA(a.getJump(i), b.getJump(i), i);
	}

	get info() {
		if (this.ancestors.length === 0) {
			return [0];
		}
		if (this._info) {
			return this._info;
		}
		const infoParent = this.ancestors[0].info;
		let info;
		if (this.index > 0) {
			const plus = this.index > 3 ? `+{${this.index}}` : '+'.repeat(this.index);
			info = infoParent.concat([plus, 0]);
		} else {
			info = infoParent.with(-1, infoParent.at(-1) + 1);
		}
		return (this._info = info);
	}
	toString() {
		return this.info.join('');
	}
}

export default ParentTree;
