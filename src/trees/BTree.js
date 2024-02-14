import {assert} from '../utils.js';
import Tree from './baseTree.js';

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

export const $23Tree = position => BTree(3, position);
export const $234Tree = position => BTree(4, position);

export default BTree;
