import {assert, range, sum, replace, randomChoice} from '../utils.js';

class Tree {
    constructor(epoch, children = [], childTrace = null) {
        this.epoch = epoch;

        this.parentHistory = [[-Infinity, null]];
        this.children = children;
        for (const child of children) {
            child.setParent(epoch, this);
        }

        if (this.isLeaf) {
            this.height = 0;
            this.size = 1;
            this.sizeLeaf = 1;
        } else {
            this.height = Math.max(...this.children.map(child => child.height)) + 1;
            this.size = sum(this.children.map(child => child.size), 1);
            this.sizeLeaf = sum(this.children.map(child => child.sizeLeaf));
        }

        if (childTrace === null) {
            assert(this.children.every(child => child.epoch < epoch));
        } else {
            assert(this.children.includes(childTrace) && childTrace.epoch === epoch);
        }
        this.childTrace = childTrace;

        this.data = {};
    }

    get isLeaf() {
        return this.children.length === 0;
    }
    * getLeaves(acknowledgingComplexity = false) {
        assert(acknowledgingComplexity, 'O(n) time complexity');
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

    getTrace() {
        if (this.childTrace === null) {
            return this;
        }
        return this.childTrace.getTrace();
    }

    /**
     *
     * binary search for the last `<= epoch` index
     * - optimize by searching from the end in the meanwhile, to accelerate the most common use cases
     *   (e.g. inserting/finding the latest epoch)
     *
     */
    indexOfEpoch(epoch) {
        let l = 0, r = this.parentHistory.length;
        let i = this.parentHistory.length-1;
        while (l + 1 < r) {
            const m = l + Math.floor((r - l) / 2); // r - l > 1, so >= 2
            if (this.parentHistory[m][0] <= epoch) {
                l = m;
            } else {
                r = m;
            }
            assert(i >= 0);
            if (this.parentHistory[i][0] <= epoch) {
                return i;
            }
            --i;
        }
        return l;
    }
    setParent(epoch, parent) {
        assert(epoch >= this.epoch, `setting parent for early epoch ${epoch} < ${this.epoch}`);
        if (parent !== null) {
            assert(epoch === parent.epoch, `setting parent for early/late epoch ${epoch} ≠ ${parent.epoch}`);
        }
        const i = this.indexOfEpoch(epoch);
        this.parentHistory.splice(i+1, 0, [epoch, parent]);
        return this;
    }
    getParent(epoch) {
        if (this.parentHistory.length === 0) {
            return null;
        }
        return this.parentHistory[this.indexOfEpoch(epoch)][1];
    }

    getRoot(epoch, caching = false) {
        if (caching) {
            if (epoch === this._epochRootCache && this._rootCache !== null) {
                return this._rootCache;
            }
            this._epochRootCache = epoch;
            this._rootCache = null;
        }
        const parent = this.getParent(epoch);
        if (parent === null) {
            if (caching) {
                return (this._rootCache = this);
            }
            return this;
        }
        if (caching) {
            return (this._rootCache = parent.getRoot(epoch));
        }
        return parent.getRoot(epoch);
    }
    * getPath(epoch, includingSelf = true) {
        if (includingSelf) {
            yield this;
        }
        const parent = this.getParent(epoch);
        if (parent === null) {
            return;
        }
        yield * parent.getPath(epoch);
    }

    getSiblings(epoch) {
        const parent = this.getParent(epoch);
        if (parent === null) {
            return [];
        }
        return replace(parent.children, this);
    }
    * getCopath(epoch) {
        for (const node of this.getPath(epoch)) {
            yield * node.getSiblings(epoch);
        }
    }

    replace(epoch, node, plugin = null) {
        const parent = this.getParent(epoch);
        if (parent === null) {
            return node;
        }
        const parentNew = new this.constructor(epoch, replace(parent.children, this, node), node);
        plugin?.align(parentNew, parent);
        return parent.replace(epoch, parentNew);
    }

    static init(n, epochInit = 0) {
        assert(Number.isInteger(n) && n > 0);
        const leafInit = new this(epochInit - (n-1));
        let root = leafInit;
        for (const i of range(1, n)) {
            const epoch = epochInit - (n-1 - i);
            root = root.add(epoch, new this(epoch), leafInit);
        }
        return root;
    }

    add(_epoch, _node, _hint = null) {
        assert(false, 'abstract add method');
    }

    remove(_epoch, _node, _hint = null) {
        assert(false, 'abstract remove method');
    }

    get info() {
        return [this.epoch, this.data];
    }
    print(hasNextList = [], Width = 2) {
        console.log([
            ...hasNextList.slice(0, -1).map(hasNext => (hasNext ? '│' : ' ') + Array(Width-1).fill(' ').join('')),
            ...hasNextList.slice(-1).map(hasNextSelf => (hasNextSelf ? '├' : '└') + Array(Width-1).fill('─').join('')),
            this.children.length > 0 ? '┮' : '╼',
        ].join(''), ...this.info);
        for (const [i, child] of this.children.entries()) {
            child.print(hasNextList.concat(i < this.children.length-1), Width);
        }
    };
}

export
class BinaryTree extends Tree {
    constructor(epoch, children, childTrace) {
        super(epoch, children, childTrace);
        assert(this.isLeaf || this.children.length === 2);
    }

    get childL() {
        if (this.isLeaf) {
            return null;
        }
        return this.children[0];
    }
    get childR() {
        if (this.isLeaf) {
            return null;
        }
        return this.children[1];
    }

    getTheSibling(epoch) {
        const siblings = this.getSiblings(epoch);
        if (siblings.length === 0) {
            return null;
        }
        assert(siblings.length === 1);
        return siblings[0];
    }
}

export default Tree;
