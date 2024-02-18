export * from './baseTree.js';
export * from './LeftTree.js';
export * from './BTree.js';
export * from './LLRBTree.js';

import {LeftTreeEnums, makeLeftTree} from './LeftTree.js';
import {BTreeEnums, makeBTree, make23Tree, make234Tree} from './BTree.js';
import {LLRBTreeEnums, makeLLRBTree} from './LLRBTree.js';

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

for (const mode of LLRBTreeEnums.mode)
for (const position of LLRBTreeEnums.position) {
    TreeTypes.set(`LLRB: mode=${mode}, pos=${position}`, makeLLRBTree(mode, position));
}
