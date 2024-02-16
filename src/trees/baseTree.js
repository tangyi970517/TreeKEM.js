import {range} from '../utils.js';

class Tree {
    constructor(parent = null, children = [], info = {}) {
        this.parent = parent;
        this.children = children;
        Object.assign(this, info);
    }
    getRoot() {
        const {parent} = this;
        if (parent === null) {
            return this;
        }
        return parent.getRoot();
    }

    get isLeaf() {
        return this.children.filter(Boolean).length === 0;
    }
    * getLeaves(acknowledgingComplexity = false) {
        if (!acknowledgingComplexity) console.warn('O(n)-time operation');
        if (this.isLeaf) {
            yield this;
            return;
        }
        for (const child of this.children) {
            yield * child.getLeaves(true);
        }
    }

    static init(n) {
        const leafInit = new this();
        let root = leafInit;
        for (const _ of range(1, n)) {
            root = root.add(new this(), leafInit);
        }
        return root;
    }

    print(hasNextList = [], Width = 2) {
        console.log([
            ...hasNextList.slice(0, -1).map(hasNext => (hasNext ? '│' : ' ') + Array(Width-1).fill(' ').join('')),
            ...hasNextList.slice(-1).map(hasNextSelf => (hasNextSelf ? '├' : '└') + Array(Width-1).fill('─').join('')),
            this.children.length > 0 ? '┮' : '╼',
        ].join(''), this.data);
        for (const [i, child] of this.children.entries()) {
            child.print(hasNextList.concat(i < this.children.length-1), Width);
        }
    };
}

export default Tree;
