import {assert, replace, randomChoice} from '../utils.js';
import {BinaryTree} from './baseTree.js';

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

/**
 *
 * left-balanced binary tree:
 * - left child is *perfect* binary tree,
 * - right child is recursively left-balanced binary tree,
 * - height of left child is no less than height of right child
 *
 * Fact.
 * [#leaf in perfect binary tree] = 2^floor(log2[#leaf])
 *
 */
class LeftTree extends BinaryTree {
    constructor(epoch, children, childTrace) {
        super(epoch, children, childTrace);

        this.rawL = this.childL;
        this.rawR = this.childR;

        if (this.isLeaf) {
            this.isPerfect = true;
            this.sizeRemoved = 0;
            this.leftmostRemoved = null;
        } else {
            assert(this.rawL.isPerfect);
            assert(this.rawR.height <= this.rawL.height);
            this.isPerfect = this.rawR.isPerfect && this.rawR.height === this.rawL.height;
            this.sizeRemoved = this.rawL.sizeRemoved + this.rawR.sizeRemoved;
            this.leftmostRemoved = this.rawL.leftmostRemoved ?? this.rawR.leftmostRemoved;
        }
        assert((this.sizeRemoved === 0) === (this.leftmostRemoved === null));
    }
    static newRemoved(epoch) {
        const node = new this(epoch);
        node.sizeRemoved = 1;
        node.leftmostRemoved = node;
        return node;
    }

    get isAllRemoved() {
        return this.sizeRemoved === this.sizeLeaf;
    }
    get info() {
        return [this.isAllRemoved ? '∅' : '', this.epoch, this.data];
    }

    getClosestRemoved(epoch) {
        for (const node of this.getPath(epoch)) {
            if (node.leftmostRemoved !== null) {
                return node.leftmostRemoved;
            }
        }
        return null;
    }
    getRandomRemoved() {
        if (this.sizeRemoved === 0) {
            return null;
        }
        if (this.isLeaf) {
            return this;
        }
        return randomChoice(this.children, 'sizeRemoved', this.sizeRemoved).getRandomRemoved();
    }

    static init(n, epoch = 0) {
        assert(Number.isInteger(n) && n > 0);
        return this.initAny(epoch, n);
    }
    static initAny(epoch, n) {
        if (n === 1) {
            return new this(epoch);
        }
        const h = Math.floor(Math.log2(n)), nL = Math.pow(2, h);
        if (nL === n) {
            return this.initPerfect(epoch, h);
        }
        assert(nL < n);
        const children = [
            this.initPerfect(epoch, h),
            this.initAny(epoch, n - nL),
        ];
        return new this(epoch, children, children[0]); // arbitrary trace
    }
    static initPerfect(epoch, h) {
        if (h === 0) {
            return new this(epoch);
        }
        const children = [
            this.initPerfect(epoch, h-1),
            this.initPerfect(epoch, h-1),
        ];
        return new this(epoch, children, children[0]); // arbitrary trace
    }

    append(epoch, leaf) {
        if (this.isPerfect) {
            return new this.constructor(epoch, [this, leaf], leaf);
        }
        const childNew = this.rawR.append(epoch, leaf);
        return new this.constructor(epoch, [this.rawL, childNew], childNew);
    }

    truncate(epoch) {
        if (this.isAllRemoved) {
            return null;
        }
        if (this.isLeaf) {
            return this;
        }
        const childNew = this.rawR.truncate(epoch);
        if (childNew !== null) {
            if (childNew === this.rawR) {
                return this;
            }
            const childTrace = childNew.epoch === epoch ? childNew : null;
            return new this.constructor(epoch, [this.rawL, childNew], childTrace);
        }
        return this.rawL.truncate(epoch);
    }

    add(epoch, leaf, hint = null) {
        assert(leaf.isLeaf && leaf.getRoot(epoch) !== this);
        assert(hint === null || /* hint.isLeaf && */ hint.getRoot(epoch) === this);
        let leafRemoved = null;
        switch (position) {
            case 'greedy': {
                leafRemoved = hint?.getClosestRemoved(epoch);
            } break;
            case 'random': {
                leafRemoved = this.getRandomRemoved();
            } break;
            case 'append': {} break;
        }
        if (leafRemoved) {
            return leafRemoved.replace(epoch, leaf);
        }
        return this.append(epoch, leaf);
    }

    remove(epoch, leaf, _hint) {
        const leafRemoved = this.constructor.newRemoved(epoch);
        const rootNew = leaf.replace(epoch, leafRemoved);
        switch (truncate) {
            case 'truncate': {
                const rootTruncate = rootNew.truncate(epoch);
                assert(rootTruncate, 'attempting to remove the last node');
                if (rootTruncate.epoch < epoch) {
                    rootTruncate.setParent(epoch, null);
                }
                return rootTruncate;
            } break;
            case 'keep': {
                return rootNew;
            } break;
        }
    }
}
    );
};

export default makeLeftTree();
