export * from './baseTree.js';
export * from './LeftTree.js';
export * from './BTree.js';

import {LeftTreeEnums, makeLeftTree} from './LeftTree.js';
import {BTreeEnums, makeBTree, make23Tree, make234Tree} from './BTree.js';

export
const TreeTypes = new Map();
for (const position of LeftTreeEnums.position)
for (const truncate of LeftTreeEnums.truncate) {
    TreeTypes.set(`left: pos=${position}, rem=${truncate}`, makeLeftTree(position, truncate));
}
for (const position of BTreeEnums.position) {
    TreeTypes.set(`2-3: pos=${position}`, make23Tree(position));
    TreeTypes.set(`2-3-4: pos=${position}`, make234Tree(position));
}
for (const m of [5, 8, 13, 21])
for (const position of BTreeEnums.position) {
    TreeTypes.set(`B: max=${m}, pos=${position}`, makeBTree(m, position));
}
