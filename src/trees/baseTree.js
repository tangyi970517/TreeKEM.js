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

export const testTree = (TreeType, n = 10) => {
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

export default Tree;
