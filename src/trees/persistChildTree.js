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
		if (this.isLeaf) {
			yield this;
			return;
		}
		for (const child of this.children) {
			yield * child.getLeaves(true);
		}
	}
	getRandomLeaf() {
		if (this.isLeaf) {
			return this;
		}
		return randomChoice(this.children, 'sizeLeaf', this.sizeLeaf).getRandomLeaf();
	}
}

export default ChildTree;
