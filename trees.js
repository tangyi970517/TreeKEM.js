import {assert} from "./utils.js";

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
}

const LeftTree = (position = 'greedy', truncate = 'truncate') => {
    assert([
        'greedy',
        'random',
        'append',
    ].includes(position) && [
        'truncate',
        'keep',
    ].includes(truncate));
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

const BTree = (m = 3, position = 'greedy') => {
    assert([
        'greedy',
        'random',
    ].includes(position));
    const max = m, min = Math.ceil(m / 2);
    return (
class BTree extends Tree {
    // constructor = super
    addSibling(leaf = new this.constructor(), info = {}, onRemoveChild = () => {}) {
        const {parent} = this;
        if (parent === null) {
            const root = new this.constructor(undefined, [this, leaf], info);
            this.parent = leaf.parent = root;
            return root;
        }
        assert(parent.children.length <= max);
        parent.children.splice(parent.children.indexOf(this), 1);
        parent.children.push(this, leaf); // move node to the end, next to the new leaf
        leaf.parent = parent;
        if (parent.children.length > max) {
            const node = new this.constructor(parent.parent, parent.children.splice(min), info);
            for (const child of node.children) {
                child.parent = node;
            }
            onRemoveChild(parent, parent.parent, ...node.children);
            if (parent.parent === null) {
                const root = new this.constructor(undefined, [parent, node], info);
                parent.parent = node.parent = root;
                return root;
            }
            return parent.addSibling(node, info, onRemoveChild);
        }
        return parent.getRoot();
    }
    removeSelf(onRemoveChild = () => {}, onAddChild = () => {}) {
        const {parent} = this;
        if (parent === null) {
            throw new Error('attempting to delete the last node');
        }
        parent.children.splice(parent.children.indexOf(this), 1);
        if (parent.children.length < min && parent.parent !== null) {
            let p;
            // try move
            p = parent.parent.children.find(p => /* p !== parent && */ p.children.length > min);
            if (p !== undefined) {
                const move = p.children.pop();
                parent.children.push(move);
                move.parent = parent;
                onRemoveChild(p, parent.parent, move);
                // onAddChild(parent, parent.parent, move); // not necessary
                return parent.getRoot();
            }
            // try merge
            p = parent.parent.children.find(p => p !== parent && p.children.length + parent.children.length <= max);
            if (p !== undefined) {
                p.children.push(...parent.children);
                for (const child of parent.children) {
                    child.parent = p;
                }
                const children = parent.children;
                parent.children = [];
                onAddChild(p, parent.parent, ...children);
                return parent.removeSelf(onRemoveChild, onAddChild);
            }
            // either move or merge must succeed
            assert(false);
        } else if (parent.parent === null && parent.children.length === 1) {
            const root = parent.children[0];
            root.parent = null;
            return root;
        }
        return parent.getRoot();
    }
    add(leaf, hint, info, onRemoveChild) {
        switch (position) {
            case 'greedy': {
                return hint.addSibling(leaf, info, onRemoveChild);
            } break;
            case 'random': {
                const that = this;
                const leaves = [...function * getLeaves(root = that) {
                    if (root.children.length === 0) { // leaf
                        yield root;
                        return;
                    }
                    for (const child of root.children) {
                        yield * getLeaves(child);
                    }
                }()];
                const hint = leaves[Math.floor(Math.random() * leaves.length)];
                return hint.addSibling(leaf, info, onRemoveChild);
            } break;
        }
    }
    remove(leaf, onRemoveChild, onAddChild) {
        return leaf.removeSelf(onRemoveChild, onAddChild);
    }
}
    );
};
const $23Tree = position => BTree(3, position);
const $234Tree = position => BTree(4, position);

const testTree = (TreeType, n = 10) => {
    const print = (tree, depth = 0) => {
        if (tree === null) {
            return;
        }
        if (depth === 0) {
            console.info(tree);
        }
        console.log(Array(depth).fill('--').join('') + (tree.recycle || tree.perfect || tree.children.length));
        for (const child of tree.children) {
            print(child, depth + 1);
        }
    };
    let tree = new TreeType();
    const leaf = tree;
    print(tree);
    for (let i = 0; i < n; ++i) {
        tree = tree.add(undefined, leaf);
        print(tree);
    }
};

// testTree(LeftTree());
// testTree($23Tree());
// testTree($234Tree());

export default Tree;
export {LeftTree, BTree, $23Tree, $234Tree};
export {testTree};
