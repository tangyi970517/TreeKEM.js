import {sum, randomChoice} from '../utils.js';

class ChildTree {
	constructor(children = []) {
		this.children = children;

		if (this.isLeaf) {
			this.height = 0;
			this.size = 1;
			this.sizeLeaf = 1;
		} else {
			this.height = Math.max(...this.children.map(child => child.height)) + 1;
			this.size = sum(this.children.map(child => child.size), 1);
			this.sizeLeaf = sum(this.children.map(child => child.sizeLeaf));
		}
	}

	get isLeaf() {
		return this.children.length === 0;
	}
	* getLeaves() {
		//
yield * function * getLeaves(node) {
		//
		if (node.isLeaf) {
			yield node;
			return;
		}
		for (const child of node.children) {
			yield * getLeaves(child);
		}
		//
}(this);
		//
	}
	getRandomLeaf() {
		if (this.isLeaf) {
			return this;
		}
		return randomChoice(this.children, 'sizeLeaf', this.sizeLeaf).getRandomLeaf();
	}
}

export default ChildTree;
