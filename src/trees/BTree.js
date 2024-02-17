import {assert, range, replace} from '../utils.js';
import Tree from './baseTree.js';

export
const BTreeEnums = {
    position: [
        'greedy',
        'random',
    ],
};

export
const makeBTree = (m = 3, position = 'greedy') => {
    assert(Number.isInteger(m) && m >= 3);
    assert(BTreeEnums.position.includes(position));
    const max = m, min = Math.ceil(m / 2);
    return (
class BTree extends Tree {
    constructor(epoch, children, childTrace) {
        super(epoch, children, childTrace);

        if (!this.isLeaf) {
            assert(this.children.length > 1);
            assert(this.children.length <= max);
            for (const child of this.children) {
                assert(child.height === this.height - 1);
                if (!child.isLeaf) {
                    assert(child.children.length >= min);
                }
            }
        }
    }

    static init(n, epoch = 0) {
        assert(Number.isInteger(n) && n > 0);
        if (n === 1) {
            return new this(epoch);
        }
        const h = Math.ceil(Math.log(n) / Math.log(max));
        return this.initGivenHeight(epoch, n, h, false);
    }
    static initGivenHeight(epoch, n, h, forcingMin = true) {
        if (n === 1) {
            assert(h === 0);
            return new this(epoch);
        }
        const M = Math.pow(min, h-1);
        if (forcingMin) {
            assert(n >= min * M);
        }
        const k = Math.min(Math.floor(n / M), max);
        const m = Math.floor(n / k), r = n % k;
        const children = Array.from(range(k), i => this.initGivenHeight(epoch, m + Number(i < r), h-1));
        return new this(epoch, children, children[0]); // arbitrary trace
    }

    addSibling(epoch, sibling, nodeReplace = this) {
        const parent = this.getParent(epoch);
        if (parent === null) {
            return new this.constructor(epoch, [nodeReplace, sibling], sibling);
        }
        const peers = replace(parent.children, this, nodeReplace);
        if (peers.length < max) {
            peers.push(sibling);
            const parentNew = new this.constructor(epoch, peers, sibling);
            return parent.replace(epoch, parentNew);
        }
        assert(peers.length === max);
        /**
         *
         * split `peers` into two halves
         * - such that `this` (or `nodeReplace`) is on the no-larger side, and then `sibling` can be placed on the same side
         * - this means if `max` is odd and `this` is at the middle, then need to move `this` (e.g., to the end)
         *
         */
        if (max % 2 === 1 && nodeReplace === peers[min-1]) {
            peers.splice(min-1, 1);
            peers.push(nodeReplace);
        }
        let peersStay, peersMove;
        if (peers.indexOf(nodeReplace) >= min) {
            peersStay = peers.slice(0, min);
            peersMove = peers.slice(min);
        } else {
            peersMove = peers.slice(0, -min);
            peersStay = peers.slice(-min);
        }
        peersMove.push(sibling);
        const parentNew = new this.constructor(epoch, peersStay, null);
        const nodeNew = new this.constructor(epoch, peersMove, sibling);
        return parent.addSibling(epoch, nodeNew, parentNew);
    }

    removeSelf(epoch, hint = null, siblingToReplace = null, nodeReplace = null) {
        const parent = this.getParent(epoch);
        if (parent === null) {
            assert(false, 'attempting to remove the last node');
        }
        const peers = siblingToReplace === null ? parent.children : replace(parent.children, siblingToReplace, nodeReplace);
        const siblings = replace(peers, this);
        const grandparent = parent.getParent(epoch);
        if (grandparent === null && siblings.length === 1) {
            const sibling = siblings[0];
            assert(nodeReplace === null || sibling === nodeReplace);
            if (sibling.epoch < epoch) {
                sibling.setParent(epoch, null);
            }
            return sibling;
        } else if (grandparent === null || siblings.length >= min) {
            const parentNew = new this.constructor(epoch, siblings, nodeReplace);
            return parent.replace(epoch, parentNew);
        }
        assert(siblings.length === min-1);
        /**
         *
         * borrow into or merge `siblings`, under the following precedence:
         * 01. merge next to hint
         * 01. borrow hint
         * 01. merge into any
         * 01. borrow from any
         *
         * for borrowing:
         * - let l be the number of children in the borrowed parent sibling
         * - borrow first or last (l-min) cousins if containing hint
         * - borrow hint alone if hint in the middle
         * - borrow last (l-min) cousins if no hint
         *
         * for merging:
         * - merge at the end
         *
         */
        const parentSiblings = parent.getSiblings(epoch);
        const hintParent = hint?.getParent(epoch);
        assert((hint === null) === (hintParent === null));
        let parentSibling = null, merging = null;
        if (parentSiblings.includes(hintParent)) {
            parentSibling = hintParent;
            merging = hintParent.children.length <= max - min + 1;
        } else {
            for (const parentSiblingTry of parentSiblings) {
                if (parentSiblingTry.children.length <= max - min + 1) {
                    parentSibling = parentSiblingTry;
                    merging = true;
                }
            }
            if (parentSibling === null) {
                parentSibling = parentSiblings[0]; // arbitrary sibling
                merging = false;
            }
        }
        assert(parentSibling !== null);
        if (!merging) {
            assert(parentSibling.children.length > min);
            let cousinsStay, cousinsMove;
            if (parentSibling === hintParent) {
                const i = hintParent.children.indexOf(hint);
                assert(i >= 0);
                const l = hintParent.children.length;
                if (i >= min) {
                    cousinsStay = hintParent.children.slice(0, min);
                    cousinsMove = hintParent.children.slice(min);
                } else if (i < l - min) {
                    cousinsMove = hintParent.children.slice(0, -min);
                    cousinsStay = hintParent.children.slice(-min);
                } else {
                    cousinsStay = replace(hintParent.children, hint);
                    cousinsMove = [hint];
                }
            } else {
                cousinsStay = parentSibling.children.slice(0, min);
                cousinsMove = parentSibling.children.slice(min);
            }
            const siblingsNew = [].concat(cousinsMove, siblings);
            const parentNew = new this.constructor(epoch, siblingsNew, nodeReplace);
            const parentSiblingNew = new this.constructor(epoch, cousinsStay, null);
            const parentPeers = replace(replace(grandparent.children, parent, parentNew), parentSibling, parentSiblingNew);
            const grandparentNew = new this.constructor(epoch, parentPeers, parentNew);
            return grandparent.replace(epoch, grandparentNew);
        }
        assert(parentSibling.children.length <= max - min + 1);
        const cousinsNew = [].concat(parentSibling.children, siblings);
        const parentSiblingNew = new this.constructor(epoch, cousinsNew, nodeReplace);
        return parent.removeSelf(epoch, hintParent, parentSibling, parentSiblingNew);
    }

    add(epoch, leaf, hint = null) {
        assert(/* leaf.isLeaf && */ leaf.getRoot(epoch) !== this);
        assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
        let sibling;
        switch (position) {
            case 'greedy': {
                sibling = hint ?? this.getRandomLeaf();
            } break;
            case 'random': {
                sibling = this.getRandomLeaf();
            } break;
        }
        return sibling.addSibling(epoch, leaf);
    }

    remove(epoch, leaf, hint = null) {
        assert(/* leaf.isLeaf && */ leaf.getRoot(epoch) === this);
        assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
        return leaf.removeSelf(epoch, hint);
    }
}
    );
};

export
const make23Tree = position => makeBTree(3, position);
export
const make234Tree = position => makeBTree(4, position);

export
const $23Tree = make23Tree();
export
const $234Tree = make234Tree();

export default makeBTree();
