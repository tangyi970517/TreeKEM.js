import {assert, range} from './utils.js';

export
const TreeKEMEnums = {
    addStrategy: [
        'async',
        'sync',
    ],
    removeStrategy: [
        'remover',
        'remover-before',
        'removee',
    ],
    updateStrategy: [
        'LCA',
        'root',
    ],
    mergeStrategy: [
        'blank',
        'keep',
    ],
    splitStrategy: [
        'blank',
        'keep',
    ],
};

export
const makeTreeKEM = (TreeType, add = 'async', remove = 'remover', update = 'LCA', merge = 'blank', split = 'blank') => {
    assert(TreeKEMEnums.addStrategy.includes(add));
    assert(TreeKEMEnums.removeStrategy.includes(remove));
    assert(TreeKEMEnums.updateStrategy.includes(update));
    assert(TreeKEMEnums.mergeStrategy.includes(merge));
    assert(TreeKEMEnums.splitStrategy.includes(split));
    return (
class TreeKEM {
    constructor() {
        this.root = new TreeType(undefined, undefined, {removed: false, id: 0, counts: [0, 0, 0, 0, 0, 0]});
        this.users = [this.root];
    }
    init(n) {
        for (const _ of range(1, n)) {
            this.add(0, this.users.length);
        }
    }
    add(a, b) {
        assert(a in this.users && b === this.users.length);
        this.users.push(new TreeType(undefined, undefined, {removed: false, id: b, counts: [0, 0, 0, 0, 0, 0]})); // counts: [prg, gen, enc, dec, dec-prg, dec-gen]
        const ua = this.users[a], ub = this.users[b];
        let onRemoveChild;
        switch (split) {
            case 'blank': {
                onRemoveChild = parent => (parent.secret = []);
            } break;
            case 'keep': {
                onRemoveChild = (parent, grandparent) => {
                    if (parent.secret !== true) {
                        grandparent && (grandparent.secretGrand = parent.secret);
                    } else {
                        grandparent && (grandparent.secretGrand = parent.children.slice());
                    }
                    parent.secret = [];
                };
            } break;
        }
        switch (add) {
            case 'async': {
                // modify tree
                this.root = this.root.add(ub, ua, {secret: [], secretGrand: []}, onRemoveChild);
                // blank out
                let node = ub.parent;
                while (node !== null) {
                    node.secret = [];
                    node = node.parent;
                }
            } break;
            case 'sync': {
                // modify tree
                const blanks = [];
                this.root = this.root.add(ub, ua, {secret: [], secretGrand: []}, (parent, grandparent, ...children) => {
                    if (parent.secret !== true) {
                        parent.secret = parent.secret.filter(c => !children.includes(c)); // ensure secret subset children
                    }
                    blanks.push([parent, grandparent]);
                });
                // update
                this.update(b, a);
                // modify tree cont.
                for (const [node, parent] of blanks) {
                    onRemoveChild(node, parent);
                }
            } break;
        }
    }
    remove(a, b) {
        assert(a in this.users && b in this.users && b !== a);
        const ua = this.users[a], ub = this.users[b];
        this.setRemoved(ub);
        let onAddChild;
        switch (merge) {
            // grandparent always not null
            case 'blank': {
                onAddChild = parent => (parent.secret = []);
            } break;
            case 'keep': {
                onAddChild = (parent, grandparent, ...children) => (parent.secret = parent.children.filter(c => !children.includes(c)));
            } break;
        }
        switch (remove) {
            case 'remover': {
                // blank out
                let node = ub.parent;
                while (node !== null) {
                    node.secret = [];
                    node = node.parent;
                }
                // modify tree
                const blanks = [], merges = [];
                this.root = this.root.remove(ub, (parent, grandparent, ...children) => {
                    if (parent.secret !== true) {
                        parent.secret = parent.secret.filter(c => !children.includes(c)); // ensure secret subset children
                    }
                    blanks.push(parent);
                }, (parent, grandparent, ...children) => merges.push([parent, children]));
                // update at remover
                this.update(a);
                // modify tree cont.
                for (const node of blanks) {
                    node.secret = [];
                }
                for (const [node, children] of merges) {
                    onAddChild(node, ...children);
                }
            } break;
            case 'remover-before': {
                // blank out
                let node = ub.parent;
                while (node !== null) {
                    node.secret = [];
                    node = node.parent;
                }
                // update at remover
                this.update(a);
                // modify tree
                this.root = this.root.remove(ub, parent => (parent.secret = []), onAddChild);
            } break;
            case 'removee': {
                // update at removee
                this.update(b, a);
                // modify tree
                this.root = this.root.remove(ub, parent => (parent.secret = []), onAddChild);
            } break;
        }
    }
    setRemoved(leaf, removed = true) {
        leaf.removed = removed;
        const updateRemoved = root => {
            if ('counts' in root) { // leaf
                return;
            }
            for (const child of root.children) {
                updateRemoved(child);
            }
            root.removed = root.children.every(c => c.removed);
        };
        updateRemoved(this.root);
    }
    update(b, a = b) {
        assert(a in this.users && b in this.users);
        const ua = this.users[a], ub = this.users[b];
        this.setRemoved(ua, true); // set removed temporarily to prevent enc to oneself
        let node;
        // update and broadcast
        node = ub;
        const path = [];
        while (node !== null) {
            path.unshift(node);
            ++ua.counts[0]; // prg
            if (node.parent !== null) {
                ++ua.counts[1]; // gen
                let find = false;
                for (const copath of node.parent.children) {
                    if (copath === node) {
                        find = true;
                        continue;
                    }
                    this.constructor.broadcast(copath, ua.counts);
                }
                assert(find);
            }
            if (node !== ub) {
                node.secret = true;
            }
            node = node.parent;
        }
        this.setRemoved(ua, false); // unset removed
        // blank out
        // ineffective when a = b
        switch (update) {
            case 'LCA': {
                node = ua;
                while (!path.includes(node)) {
                    assert(node !== null);
                    node = node.parent;
                }
            } break;
            case 'root': {
                node = path[0];
            } break;
        }
        for (let i = path.indexOf(node) + 1; i < path.length - 1; ++i) {
            path[i].secret = [];
        }
    }
    static broadcast(root, counts, update = root.parent, count = true, secretGrand = []) {
        assert(root !== null);
        if (root.removed) {
            return;
        }
        if ('counts' in root) { // leaf
            if (count) {
                ++counts[2]; // enc
            }
            ++root.counts[3]; // dec
            assert(update !== null);
            for (let node = update; node !== null; node = node.parent) {
                ++root.counts[4]; // dec-prg
                if (node.parent !== null) {
                    ++root.counts[5]; // dec-gen
                }
            }
            return;
        }
        assert(root.secret === true || root.secret.every(c => root.children.includes(c)));
        let useSecretGrand = false, useSecret = false, selfSecretGrandUsed = false;
        for (const child of root.children) {
            if (secretGrand.includes(child)) {
                useSecretGrand = true;
                selfSecretGrandUsed = this.broadcast(child, null, update, false, root.secretGrand);
            } else if (root.secret === true || root.secret.includes(child)) {
                useSecret = true;
                selfSecretGrandUsed = this.broadcast(child, null, update, false, root.secretGrand);
            } else {
                selfSecretGrandUsed = this.broadcast(child, counts, update, count, root.secretGrand);
            }
        }
        if (count) {
            if (useSecret) {
                ++counts[2]; // enc
            }
            if (selfSecretGrandUsed) {
                ++counts[2]; // enc
            }
        }
        return useSecretGrand;
    }
}
    );
};

export default makeTreeKEM();
