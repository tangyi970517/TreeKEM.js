import {assert, range, binary_search_last} from './utils.js';
import ParentTree from './trees/persistParentTree.js';

class Epoch extends ParentTree {
	step() {
		return new this.constructor(this);
	}

	static lt(epochOld, epochNew) {
		return epochOld.depth < epochNew.depth && epochNew.getAncestor(epochOld.depth) === epochOld;
	}
	static ge(epochNew, epochOld) {
		return epochOld === epochNew || this.lt(epochOld, epochNew);
	}
	// no `le`, `gt` to make method calls unique
}

export
class LinearEpoch extends Epoch {
	static singletons = [];
	static getSingleton(depth) {
		if (depth >= this.singletons.length) {
			const depthStart = this.singletons.length;
			this.singletons.length = depth+1;
			for (const d of range(depthStart, depth+1)) {
				this.singletons[d] = Object.setPrototypeOf({depth: d}, this.prototype);
			}
		}
		return this.singletons[depth];
	}

	constructor(parent = null) {
		let depth;
		if (parent === null) {
			depth = 0;
		} else {
			depth = parent.depth + 1;
		}
		return LinearEpoch.getSingleton(depth); // cannot reference `this.constructor` without `super()`
	}

	get info() {
		return [this.depth];
	}

	getAncestor(depth) {
		return this.constructor.getSingleton(depth);
	}

	static lt(epochOld, epochNew) {
		return epochOld.depth < epochNew.depth;
	}

	// ... override other methods if necessary
}

export
class EpochMap {
	constructor() {
		this.data = [];
	}

	indexOfDepth(depth) {
		return binary_search_last(this.data.length, i => this.data[i][0] <= depth);
	}

	set(epoch, value) {
		const {depth} = epoch;
		const i = this.indexOfDepth(depth);
		if (i < 0 || this.data[i][0] < depth) {
			this.data.splice(i+1, 0, [depth, new Map([[epoch, value]])]);
			return;
		}
		const map = this.data[i][1];
		assert(!map.has(epoch));
		map.set(epoch, value);
	}

	delete(epoch) {
		const {depth} = epoch;
		const i = this.indexOfDepth(depth);
		assert(i >= 0 && this.data[i][0] === depth);
		const map = this.data[i][1];
		assert(map.has(epoch));
		const value = map.get(epoch);
		map.delete(epoch);
		if (map.size === 0) {
			this.data.splice(i, 1);
		}
		return value;
	}

	has(epoch) {
		const {depth} = epoch;
		const i = this.indexOfDepth(depth);
		if (i < 0 || this.data[i][0] < depth) {
			return false;
		}
		const map = this.data[i][1];
		return map.has(epoch);
	}

	getLowestAncestor(epoch) {
		const {depth} = epoch;
		const i = this.indexOfDepth(depth);
		for (let j = i; j >= 0; --j) { // inefficient for epoch tree with large width!
			const [d, map] = this.data[j];
			const ancestor = epoch.getAncestor(d);
			if (map.has(ancestor)) {
				const value = map.get(ancestor);
				return [ancestor, value];
			}
		}
		return null;
	}
}

export default Epoch;
