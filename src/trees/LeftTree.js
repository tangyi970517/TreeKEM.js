import {assert} from '../utils.js';
import Tree from './baseTree.js';

export
const LeftTreeEnums = {
    position: [
        'greedy',
        'random',
        'append',
    ],
    truncate: [
        'truncate',
        'keep',
    ],
};

export
const makeLeftTree = (position = 'greedy', truncate = 'truncate') => {
    assert(LeftTreeEnums.position.includes(position));
    assert(LeftTreeEnums.truncate.includes(truncate));
    return (
class LeftTree extends Tree { // left-balanced binary tree: left child is perfect binary tree, right child is left-balanced binary tree, and height of left child is no less than height of right child (i.e. [#leaf in left child] = 2^floor(log2[#leaf]))
    constructor(parent, children = [null, null], info) {
        super(parent, children, info);
        const [childL, childR] = children;
        this.setChildren(childR, childL);
    }
    get children() {
        return [this.childL, this.childR];
    }
    set children(children) {
        // ineffective
    }
    setChildren(childR = this.childR, childL = this.childL) {
        if (childL !== null) {
            assert(childL.perfect);
        }
        this.childL = childL;
        this.childR = childR;
        this.perfect = childL === null && childR === null ? 1 : childL.perfect === childR.perfect ? childL.perfect + 1 : NaN;
    }
    append(leaf = new this.constructor(), info = {}) {
        assert(this !== null); // leaf is always perfect
        if (this.perfect) {
            const node = new this.constructor(this.parent, [this, leaf], info);
            leaf.parent = node;
            this.parent = node;
            return node;
        }
        this.setChildren(this.childR.append(leaf, info)); // always append to right child
        return this;
    }
    truncate() {
        const node = this.childR;
        if (node === null) {
            if (!this.recycle) {
                return this;
            }
            throw new Error('attempting to remove the last node');
        }
        if ( /* node.childL === null && */ node.childR === null) { // leaf
            assert(node.childL === null);
            if (node.recycle) {
                this.childL.parent = this.parent;
                return this.childL;
            } else {
                return this;
            }
        }
        this.setChildren(this.childR.truncate());
        return this;
    }
    add(leaf, hint, info, _onRemoveChild) {
        let recycle;
        switch (position) {
            case 'greedy': {
                recycle = this.constructor.recycle(hint).next().value;
            } break;
            case 'random': {
                const recycles = [...this.constructor.recycle(hint)];
                recycle = recycles[Math.floor(Math.random() * (recycles.length + 1))]; // +1 for the chance to append
            } break;
            case 'append': {} break;
        }
        if (!recycle) {
            return this.append(leaf, info);
        }
        const parent = recycle.parent;
        recycle.parent = null;
        leaf.parent = parent;
        if (parent.childL === recycle) {
            parent.childL = leaf;
        } else {
            assert(parent.childR === recycle);
            parent.childR = leaf;
        }
        return this;
    }
    remove(leaf, _onRemoveChild, _onAddChild) {
        leaf.recycle = true;
        switch (truncate) {
            case 'truncate': {
                let root = this;
                while (true) {
                    const rootNew = root.truncate();
                    if (rootNew === root) {
                        break;
                    }
                    root = rootNew;
                }
                return root;
            } break;
            case 'keep': {
                return this;
            } break;
        }
    }
    static * recycle(leaf) {
        let node = leaf;
        assert(node !== null);
        while (node.parent !== null) {
            if (node.parent.childL === node) {
                yield * this.recycleLeaves(node.parent.childR);
            } else {
                assert(node.parent.childR === node);
                yield * this.recycleLeaves(node.parent.childL);
            }
            node = node.parent;
        }
    }
    static * recycleLeaves(root) {
        if ( /* root.childL === null && */ root.childR === null) { // leaf
            assert(root.childL === null);
            if (root.recycle) {
                yield root;
            }
            return;
        }
        assert(root.childL !== null && root.childR !== null);
        yield * this.recycleLeaves(root.childL);
        yield * this.recycleLeaves(root.childR);
    }
}
    );
};

export default makeLeftTree();
