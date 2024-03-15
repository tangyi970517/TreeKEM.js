export * from './baseTree.js';
export * from './LeftTree.js';
export * from './PerfectTree.js';
export * from './BTree.js';
export * from './LLRBTree.js';
export * from './SplayTree.js';

import {LeftTreeEnums, makeLeftTree} from './LeftTree.js';
import {PerfectTreeEnums, makePerfectTree} from './PerfectTree.js';
import {BTreeEnums, makeBTree, make23Tree, make234Tree} from './BTree.js';
import {LLRBTreeEnums, makeLLRBTree} from './LLRBTree.js';
import {SplayTreeEnums, makeSplayTree} from './SplayTree.js';

export
const TreeTypes = new Map();

for (const position of LeftTreeEnums.position)
for (const truncate of LeftTreeEnums.truncate)
{
	TreeTypes.set(`left: pos=${position}, rem=${truncate}`, makeLeftTree(position, truncate));
}

for (const position of PerfectTreeEnums.position)
for (const truncate of PerfectTreeEnums.truncate)
{
	TreeTypes.set(`left: perfect, pos=${position}, rem=${truncate}`, makePerfectTree(position, truncate));
}

for (const position of BTreeEnums.position)
for (const remove of BTreeEnums.remove)
{
	TreeTypes.set(`2-3: pos=${position}, rem=${remove}`, make23Tree(position));
	TreeTypes.set(`2-3-4: pos=${position}, rem=${remove}`, make234Tree(position));
}
for (const m of [5, 8, 13, 21])
for (const position of BTreeEnums.position)
for (const remove of BTreeEnums.remove)
{
	TreeTypes.set(`B: max=${m}, pos=${position}, rem=${remove}`, makeBTree(m, position));
}

for (const mode of LLRBTreeEnums.mode)
for (const position of LLRBTreeEnums.position)
for (const remove of BTreeEnums.remove)
{
	TreeTypes.set(`LLRB: mode=${mode}, pos=${position}, rem=${remove}`, makeLLRBTree(mode, position));
}

for (const add of SplayTreeEnums.add)
for (const remove of SplayTreeEnums.remove)
for (const update of SplayTreeEnums.update)
{
	TreeTypes.set(`splay: add=${add}, rem=${remove}, upd=${update}`, makeSplayTree(remove, add, update));
}

export
const DefaultTreeTypes = new Map();

DefaultTreeTypes.set('left', makeLeftTree());
DefaultTreeTypes.set('left:perfect', makePerfectTree());
DefaultTreeTypes.set('2-3', make23Tree());
DefaultTreeTypes.set('2-3-4', make234Tree());
DefaultTreeTypes.set('LLRB', makeLLRBTree());
DefaultTreeTypes.set('splay', makeSplayTree());
