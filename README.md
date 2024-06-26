# TreeKEM.js

> A TreeKEM Library in JavaScript/ECMAScript Focusing on Generalization about **Tree**s and **K**nown Variants, **E**xtensibility, and **M**odularization

TreeKEM is a *continuous group key agreement* (CGKA) protocol, which means:
- it aims at establishing agreed/shared keys among users;
- it serves a group (in contrast to just a pair) of users;
- it reacts to continuous, dynamic group membership changes, where *forward secrecy* (FS) and *post-compromise security* (PCS) get into consideration.

# Usage

Find the library source codes in `src/`.

`src/TreeKEM.js` gives the TreeKEM protocol.

`src/trees/` contains various tree data structures.

`src/crypto/` contains various cryptography suites, including an insecure counter implementation for profiling efficiency.

## API

TBD.

# Specification

## *Unsorted* Balanced Tree Data Structures

### Notations and Utilities

In this specification, for simplicity, we regard a tree as a child list, despite there being tons of other fields at a tree node.
E.g., a leaf is then the empty list `()`, and `((), ())` gives a simple binary tree.

We denote some handy list operations as follows:
- `#L`: the length of list `L`;
- `L/x/y`: replace item `x` in list `L` by item `y`, with the assertion that `x` must exist (only once) in `L`;
  we also write `L/x/` for removing item `x`;
- `L1 ++ L2`: concatenate two lists `L1` and `L2`.

Each (balanced) tree data structure provides the following interface:
- `init(n: PosInt) -> Tree`: initialize a tree with `n` leaves;
- `add(t: Tree, l: Leaf; h: Leaf?) -> Tree`: add a leaf `l` to tree `t`, with an optional "hint" leaf `h` suggesting that leaf `l` is added as "close" to `h` as possible, where the distance is roughly measured by the graph distance between `l` and `h` on the tree;
- `remove(t: Tree, l: Leaf; h: Leaf?) -> Tree`: remove a leaf `l` from tree `t`, with an optional "hint" leaf `h` suggesting that, roughly speaking, changes to the tree are as "close" to `h` as possible.

We also assume that parent links are available, denoted by `parent(t: Tree) -> Tree?`, which enables writing algorithms bottom-up.
Note that `parent(t) = null` checks whether `t` is a root.

We define a handy bottom-up utility `replace(t: Tree, t': Tree) -> Tree`:
01. if `t` is root then return `t'`
01. let `p := parent(t)`
01. let `p' := p/t/t'`
01. return `replace(p, p')`

### Generic "Lazy" Tree

MLS takes a "lazy remove" approach and introduces "blank" leaf nodes.
Here we refer to these nodes as "removed" instead, since the concept of "blank" nodes also occurs in TreeKEM with a different (yet related) meaning.
Also, the notion of being "removed" naturally extends to internal nodes: an internal node is "removed" if all of its children are "removed", recursively.
To remark, the "lazy remove" approach applies to arbitrary tree data structure; in particular we have the following generic implementations.

Function `add(t: Tree, l: Leaf; h: Leaf?) -> Tree`:
01. if there is no "removed" leaf in `t` then undefined
    > This branch means the generic add operation is infeasible, and a concrete tree data structure must give its own implementation for the add operation at least in this case.
01. if `h ≠ null` then let `r` be an arbitrary (say, leftmost) closest "removed" leaf to `h`
01. else let `r` be an arbitrary (say, random) "removed" leaf in `t`
01. return `replace(r, l)`

Function `remove(_t: Tree, l: Leaf; _h: Leaf?) -> Tree`:
(ineffective hint)
01. let `r` be a new "removed" leaf
01. return `replace(l, r)`

### Left-balanced Binary Tree (LBBT)

Definition.
An LBBT is either a single leaf node, or a tree satisfying all of the following:
- the root has two children (i.e., binary and *full*);
- the left child is a *perfect* binary tree;
- the right child is recursively an LBBT, whose height is no larger than the left child.

> In some sense LBBT is *the* append-only binary tree data structure.

Function `init(n: PosInt) -> LBBT`:
There is a unique structure for LBBT with `n` leaves; namely:
01. if `n = 1` then return `()`
01. let `h := floor(log2(n))`
01. if `n` is a power of 2, i.e., if `n = 2^h`, then return a perfect binary tree with height `h`
01. let `tl` be a perfect binary tree with height `h`
01. let `tr := init(n - 2^h)`, recursively.
01. return `(tl, tr)`

Function `append(t: LBBT, l: Leaf) -> LBBT`:
01. if `t` is perfect then return `(t, l)`
    > Note that leaf is always perfect.
01. let `(tl, tr) := t`
01. return `(tl, append(tr, l))`

Function `truncate(t: LBBT) -> LBBT?`:
> This function truncates a tree with "removed" nodes, so that the rightmost leaf is not "removed" (and non-"removed" leaves remain untouched).
01. if all leaves in `t` are "removed" then return `null`
01. if `t` is leaf then return `t`
01. let `(tl, tr) := t`
01. let `tr' := truncate(tr)`
01. if `tr' ≠ null` then return `(tl, tr')`
01. return `truncate(tl)`

Function `add(t: LBBT, l: Leaf; h: Leaf?) -> LBBT`:
01. if there is "removed" leaf in `t` then return `GenericLazy.add(t, l; h)`
01. return `append(t, l)`

Function `remove(t: LBBT, l: Leaf; _h: Leaf?) -> LBBT`:
(ineffective hint)
01. let `t' := GenericLazy.remove(t, l)`
01. return `truncate(t')`
    > If the return value is `null` then it means the last node in the tree is removed and we might raise an error, depending on the use case.

#### [Legacy] Variant: random add

In `add`:
instead of `GenericLazy.add(t, l; h)`, use `GenericLazy.add(t, l; null)` (notice the null hint, which lets `GenericLazy.add` choose a random "removed" leaf).

#### [Legacy] Variant: random add/append

In `add`:
01. let `m` be the number of "removed" leaf in `t`
01. with probability `m/(m+1)`, return `GenericLazy.add(t, l; null)` (notice the null hint, which lets `GenericLazy.add` choose a random "removed" leaf)
01. with probability `1/(m+1)`, return `append(t, l)`

#### [Legacy] Variant: append-only

In `add`:
do not `GenericLazy.add` and always `append`.

#### Variant: leftmost add

In `add`:
instead of `GenericLazy.add(t, l; h)`, use `GenericLazy.add(t, l; null)` and inside use the leftmost instead of a random "removed" leaf as `r`.

#### Variant: no-truncate

In `remove`:
do not `truncate` and return `t'` directly.

#### Variant: perfect mode

In perfect mode, LBBT is restricted to always be a *perfect* binary tree (of course allowing "removed" leaves).
The algorithms change as follows.

- In `init`: create a perfect binary tree with height `h := ceil(log2(n))`, where the rightmost `2^h - n` leaves are "removed"
- In `append`: create a perfect binary tree `tr` with the same height as `t`, and with leftmost leaf `l` (and other leaves in `tr` are all "removed"); return `(t, tr)`
- In `truncate`: instead of computing `tr'`, if not all leaves in `tr` are "removed" then return `t` (and otherwise still return `truncate(tl)` recursively)

#### Variant: balanced LBBT

Our implementation of LBBT above is based on the generic "lazy" operations.
Note that technically speaking, the tree is no longer worst-case *balanced* (i.e., height is logarithmic in the number of *true* leaves) by having lazily removed leaves.
It is actually possible to get rid of the generic "lazy" operations and design a balanced mode for LBBT.
In particular, `truncate` can only help remove a rightmost leaf, and we need an operation for removing node at arbitrary position.

To better see the idea behind the new algorithm, consider the following view:
an LBBT with `n` leaves is a "chain on the right" of perfect subtrees with respectively `2^h[1], …, 2^h[m]` leaves, corresponding to the binary expansion of `n` (and we order from the least significant power of 2 to the most);
the perfect subtrees `t[1], …, t[m]` are "chained on the right" as `(t[m], (t[m-1], … (t[2], t[1]) … ))`.
Under this view, to remove a leaf is then to "split" the perfect subtree for `h[i]` containing that leaf into `0, 1, …, h[i]-1`, and then to "merge" these with `h[1], …, h[i-1]`.
One (or essentially, *the*) strategy minimizing further breaking up the perfect subtrees is to borrow `h[1]` (note that `h[1] < h[i]` and thus `h[1] ≤ h[i]-1`), let `h[1], h[1], …, h[i]-1` reconstruct `h[i]`, and put the remaining `0, 1, …, h[1]-1` to the head.
This strategy leads to the following `pop` algorithm.

Function `split(t: LBBT, v: LBBT) -> LBBT[]`:
01. return the copath of `v` below `t`, *bottom-up*

Function `merge(L: LBBT[]) -> LBBT`:
01. if `#L = 1` then return the first item in `L`
01. let `tr, tl` be the first two items in `L`, and `L'` be the remaining items
01. return `merge([(tl, tr)] ++ L')`

Function `pop(t: LBBT, l: Leaf) -> LBBT`:
01. let `p` be the highest root of a *perfect* subtree on the path from `l` to the root
    > `p` would be the root of the perfect subtree for `h[i]` containing `l`.
01. let `ip := parent(p)`
    > Note that `ip`, if not null, must be a root of an *imperfect* subtree, by the extremality of `p`.
01. if `p = l`:
    01. if `p` is root then undefined
        > This branch means the last node in the tree is removed and we might raise an error, depending on the use case.
    01. let `(ps, _p) := ip`
        > Note that `p = l` must be a right child: if `p` were a left child, then the right child must also be a single leaf by the constraint of LBBT, and then `ip` would be perfect, contradicting the fact that `ip` must be imperfect.
    01. return `replace(ip, ps)`
01. let `S := split(p, t)`
01. if `p` is root or `p` is the right child of `ip`:
    01. return `replace(p, merge(S))`
01. let `(_p, ps) := ip`
01. let `r` be the first root of a perfect subtree along the "right child chain" of `ip`
    > `r` would be the root of the perfect subtree for the smallest `h[m]`.
01. if `r = ps` and `r` is a single leaf:
    01. return `replace(ip, merge([r] ++ S))`
01. let `Sr := split(ps, r)` (if `r = ps` then `Sr := []`)
01. split `S` into `Slt ++ Sge`, where each perfect subtree in `Slt` has height less than that of `r`, and each in `Sge` has height at least that of `r`
01. let `p' := merge([r] ++ Sge)`
    > Note that `p'` is a perfect (sub)tree.
01. let `ps' := merge(Slt ++ Sr)`
01. let `ip' := (p', ps')`
01. return `replace(ip, ip')`

Then in `remove`, we can use `pop` instead of `GenericLazy.remove` and enjoy truly balanced LBBT.

### B Tree (BT)

Definition.
A BT with maximum degree/order `Δ ≥ 3` and minimum degree `δ := ceil(Δ/2)` is a tree satisfying all of the following:
- every node has at most `Δ` children;
- the root has at least two children, and every non-root internal node has at least `δ` children;
- every leaf has the same depth.

BT with `Δ=3` (and `δ=2`) is also called 2-3 tree.
BT with `Δ=4` (and `δ=2`) is also called 2-3-4 tree.

Function `init(n: PosInt; h: Int ?= ceil(log_{Δ}(n))) -> BT`:
In contrast to LBBT, the structure of a BT with `n` leaves is not unique, and here we just give an arbitrary design (that achieves minimum depth):
01. if `n = 1` then return `()`
01. let `k := min(floor(n / δ^{h-1}), Δ)`
01. let `m := floor(n / k)`, `r := n % k`
01. return `(t[1], …, t[k])`, where `t[i] := init(m+Int(i≤r); h-1)`

Function `addSibling(t: BT, s: BT; t': BT ?= t) -> BT`:
> This function can be interpreted as to "add `l` as a sibling to `t`, while replacing `t` by `t'`".
01. if `t` is root then return `(t', s)`
01. let `p := parent(t)`
01. let `peers := p/t/t'`
01. if `#p < Δ` then:
    01. let `p' := peers ++ (s)`
    01. return `replace(p, p')`
    > Now we can assert `#p = #peers = Δ`.
01. split `peers` into `p'` and `sibs`, described below
    > The strategy ensures `#p' = δ`, and hence `#sibs = Δ-δ ∈ [δ-1,δ]`.
01. let `ps := sibs ++ (s)`
    > Note that `#ps ∈ [δ,δ+1] ⊆ [δ,Δ]`.
01. return `addSibling(p, ps; p')`

Split strategy:
At a high level, the strategy splits `peers` (length `Δ`) into two balanced halves `p'` and `sibs`, with `t'` in the `sibs` part, which is no larger than the `p'` part; constructively:
01. if `Δ` is odd and `t'` is at the middle of `peers` (i.e., has index `δ` if counting from 1) then `peers := peers/t'/ ++ (t')` (i.e., to move `t'` to the end)
01. if `t'` is not among the first `δ` items of `peers` then split by `p' ++ sibs`, where `#p' = δ`
01. if `t'` is not among the last `δ` items of `peers` then split by `sibs ++ p'`, where `#p' = δ`
    > The two cases are now complete due to the fact that `t'` is not at the middle for odd `Δ`.

Function `removeSelf(t: BT, h: BT?; s: BT? ?= null, s': BT? ?= null)`:
> This function can be interpreted as to "remove `t` with 'hint' `h`, while replacing sibling `s` by `s'`".
01. if `t` is root then undefined
    > This branch means the last node in the tree is removed and we might raise an error, depending on the use case.
01. let `p := parent(t)`
01. let `p' := p/s/s'/t/` (if `s = null` then `p' := p/t/`)
01. if `p` is root or `#p' ≥ δ` then:
    01. if `#p' = 1` then return `sib`, where `(sib) := p'`
    01. return `replace(p, p')`
    > Now we can assert `#p' = δ-1`.
01. let `gp := parent(p)`, `hp := parent(h)` (if `h = null` then `hp := null`)
01. choose a sibling `ps` of `p` to borrow from or merge into, described below
    > The strategy ensures `#ps > δ` if to borrow from, and `#ps ≤ Δ-δ+1` if to merge into.
01. if to borrow from:
    01. if `ps = hp` then split `hp` into `ps'` and `sibs`, described below
        > The strategy ensures `#ps' ≥ δ`, and `#sibs ≥ 1` (as `sibs` at least contains `h`).
    01. else split `ps` into `ps' ++ sibs`, where `#ps' = δ`
    01. let `p'' := sibs ++ p'`
        > Note that `#p'' ∈ #ps - [δ,#ps-1] + δ-1 = [δ,#ps-1] ⊆ [δ,Δ-1]`.
    01. let `gp' := gp/p/p''/ps/ps'`
    01. return `replace(gp, gp')`
01. let `ps' := ps ++ p'`
    > Note that `#ps' ∈ [δ,Δ-δ+1] + δ-1 = [2δ-1,Δ] ⊆ [Δ-1,Δ]`.
01. return `removeSelf(p, hp; ps, ps')`

Borrow-or-merge strategy:
01. if `hp` is a sibling of `p` then:
    01. if `#hp ≤ Δ-δ+1` then merge into `hp`
    01. else borrow from `hp`
        > Note that in the borrow case we always have valid `#hp > Δ-δ+1 ≥ δ`; similarly for the borrow case below.
01. if there exists a sibling `ps` of `p` with `#ps ≤ Δ-δ+1` then merge into `ps`
01. else borrow from a sibling `ps` of `p`
    > The choice of `ps` in these two cases can be arbitrary; we simply pick the first one (meeting the requirement).

Borrow-hint strategy:
01. if `h` is not among the first `δ` items of `hp` then split `hp` into `ps' ++ sibs`, where `#ps' = δ`
01. if `h` is not in the last `δ` items of `hp` then split `hp` into `sibs ++ ps'`, where `#ps' = δ`
01. else let `ps' := ps/h/`, `sibs := (h)`
    > In all cases, `h` is contained in the `sibs` part.

Function `add(t: BT, l: Leaf; h: Leaf?) -> BT`:
01. if `h = null` then use an arbitrary (say, random) leaf in `t` as `h`
01. return `addSibling(h, l)`

Function `remove(t: BT, l: Leaf; h: Leaf?) -> BT`:
01. return `removeSelf(l, h)`

#### [Legacy] Variant: random add

In `add`:
use a random leaf instead of the given value (if not null) as `h`.

#### Variant: optimal add

In `add`:
use a (say, leftmost) "optimal" leaf, described below, instead of the given value (if not null) as `h`.

For every leaf, we define its "imperfect" height to be the minimum `h` so that the height-`h` subtree containing the leaf is non-full/imperfect, i.e., the subtree has less than `Δ^h` leaves.
E.g., a leaf itself is always perfect; a height-1 internal node is imperfect if and only if it has degree less than `Δ`, etc.
An "optimal" leaf is a leaf with minimum "imperfect" height.
The purpose of using an "optimal" leaf is to greedily minimize the number of recursions in `addSibling`.

#### Variant: different borrow-or-merge strategies

The borrow-or-merge strategy above essentially defines a precedence among the 4 choices:
01. merge into `hp` (parent of hint)
01. borrow from `hp`
01. merge into some `ps` (sibling of parent)
01. borrow from some `ps`
<!---->
We pick the above particular permutation as it intuitively best respects the hint: to recall, the hint suggests that changes to the tree are as "close" to the hint as possible.
This is because:
- If `hp`, parent of hint, is among the siblings of parent then either merge into or borrow (hint) from `hp` helps align the changes to the tree with hint.
- In this case we prefer merge than borrow as `hp` after borrowing would be an extra change on the copath of hint, while merging gives no extra change on the copath.
- Otherwise, we still prefer merge than borrow as it causes recursion of `removeSelf`, which intuitively gets "closer" to the hint: there might be hope that `hp` is among the siblings of parent in future recursions.
- Also, if hint is already sibling or even the same node then we still prefer merge than borrow for a similar "copath change" observation.
<!---->
We emphasize that these justifications are greedy and merely heuristic.

Technically, it is also possible to consider a precedence with any permutation of the 4 choices (so 24 permutations and 24 possible strategies).
In the implementation, we limit the possibilities by only considering whether hint takes precedence and which of borrow/merge takes precedence; i.e., we only consider the size-4 permutation subgroup generated by $(1 3) (2 4)$ and $(1 2) (3 4)$.

### (Left-leaning) Red-black Tree (LLRBT)

Definition.
An RBT is a tree satisfying all of the following:
- every node is "colored" either red or black, where the root and leaves are always black, and red nodes can only have black children;
- every internal node has two children (i.e., binary and *full*);
- every leaf has the same "black depth", defined as the number of black nodes on their path to the root.
<!---->
An LLRBT is an RBT satisfying the extra constraint that black nodes cannot have black left and red right children nodes.
> I.e., red nodes are always "leaning to the left" inside the children of black nodes.

We have the following equivalent definition for LLRBT which is recursive and more explicit:
An LLRBT is a tree matching one of the following pattern:
- a single (black) leaf node `()`;
- a "black-black" node `(t1, t2)`, where `t1`, `t2` are LLRBTs with the same "black depth";
- a "red-black" node `(R(t1, t2), t3)`, where `t1`, `t2`, `t3` are LLRBTs with the same "black depth";
  > Here `R(…)` marks a red node.
  > Recall that "left-leaning" in *LL*RBT requires that a "black-red" pattern is forbidden.
- a "red-red" node `(R(t1, t2), R(t3, t4))`, where `t1`, `t2`, `t3`, `t4` are LLRBTs with the same "black depth".

> To remark, it might be more convenient to view colors as being associated with parent-child links instead of with nodes.
> In particular, if a node after some tree operation has the same child list but flipped color (well, associated with the node), then it is regarded as an "old" instead of "new" node (as defined in the later "skeleton" section).
> In this situation, just imagine that the parent of the node changes and the color on the parent-child link changes as well, and then it is totally fine to say that nothing changes about node itself.

With the left-leaning property, red-black tree is *isomorphic* to 2-3-4 tree, via the following isomorphism `iso(t: 234Tree) -> LLRBT`:
01. if `t` is a leaf then return `t`
01. if `(t1, t2) := t` then return `(t1, t2)`
01. if `(t1, t2, t3) := t` then return `(R(t1, t2), t3)`
01. if `(t1, t2, t3, t4) := t` then return `(R(t1, t2), R(t3, t4))`

We define the "2-3 mode" of LLRBT by further forbidding the "red-red" pattern (i.e., there are only "black-black" and "red-black" patterns).
Similarly, it is easy to see that `iso` gives an isomorphism between "2-3 mode" LLRBT and 2-3 tree.

With the isomorphism `iso` and its inverse `inv` (which is also easy to compute), the operations for LLRBT are immediately induced by the corresponding operations for 2-3-4 tree (and similarly "2-3 mode" operations are induced by 2-3 tree operations):
- `init(n) := iso(234Tree.init(n))`;
- `add(t, l; h) := iso(234Tree.add(inv(t), inv(l); inv(h)))`;
- `remove(t, l; h) := iso(234Tree.remove(inv(t), inv(l); inv(h)))`.

#### Variants

LLRBT has normal and "2-3 mode" variants.
LLRBT also generically inherits all variants of BT.

#### Look-back: why are split strategy and borrow-hint strategy in BT designed so?

In a previous section we have described variants of the borrow-or-merge strategy in BT, and elaborated some reasoning behind its design.
However, the other strategies in BT might still appear quite mysterious, so here we try to unpack the mysteries.

The high-level idea in designing the split and borrow-hint strategies is to maximum the "reusing" of LLRBT nodes under the isomorphism, while keeping the strategy rules as simple and oblivious as possible.

In split strategy:
- For normal mode, `#peers = Δ = 4`, and it is split into two halves, each of size 2.
  Under the isomorphism, this means to split `(R1(B,B), R2(B,B))` into `R1(B,B)` and `R2(B,B)`, successfully reusing the LLRBT nodes.
- For "2-3 mode", `#peers = Δ = 3`, and it is split into sizes 1 and 2.
  The desired behavior is to split `(R1(B,B), B2)` into `R1(B,B)` and `B2`, but this is not necessarily possible as the hint could occur in the `R1(B,B)` part (recall that we need the hint in the no-larger half, i.e., the size-1 half).
  The only thing we could do is to split the hint alone, which is also what the split strategy does.
  Here note that when the hint is indeed the `B2` part, we successfully reuse the other LLRBT node `R1(B,B)`.

In borrow-hint strategy:
- For normal mode and `#hp = 4`, we split `hp = (R1(B,B), R2(B,B))` into `R1(B,B)` and `R2(B,B)` and borrow the half containing `h`, successfully reusing the LLRBT nodes.
- For normal mode and `#hp = 3`, we have no choice but to borrow `h` and leave the other two siblings in `hp`.
  Note that when `h` is indeed the `B2` part of `hp = (R1(B,B), B2)`, we successfully reuse the other LLRBT node `R1(B,B)`.
- For "2-3 mode" we have the unique case `#hp = 3`, and it is the same situation as in normal mode.
- By the way, the "borrow-non-hint strategy" is to "split `ps` into `ps' ++ sibs`, where `#ps' = δ`".
  With `δ = 2`, this successfully reuses the LLRBT nodes no matter whether `#ps = 4` or `#ps = 3`.
- Also by the way, the "merge strategy" is to merge by "`ps' := ps ++ p'`", i.e., to merge at the end.
  With `#p' = δ-1 = 1`, this also reuses the LLRBT node in `ps` (no matter what size `#ps ≤ Δ-δ+1` is, i.e., no matter whether `#ps = 2` or `#ps = 3`).

### Skeleton and its Path Decomposition

Each tree operation in the interface gives a new tree, and we define the *skeleton* to be the subset/subgraph of the new tree consisting of the "new" nodes, i.e., nodes that are not in the old tree (if any).
E.g., the skeleton given by the `init` operation is the entire initialized tree, as there is no old tree.
Also see the following examples for `add` and `remove`.

Example of a skeleton given by `add` (new node `8()`, with "hint" `2()`) in 2-3 tree, where nodes are labeled in front of their child list:
```
d(
  a(1(),2(),3()),
  b(4(),5()),
  c(6(),7()),
) --add(8;2)-> i(
  g(
    b(4(),5()),
    c(6(),7()),
  ),
  h(
    e(1(),3()),
    f(2(),8()),
  ),
)
```
It is easy to see that `6,e,f,g,h,i` are the "new" nodes, and thus form the skeleton;
also note that `b,c` are "old" internal nodes that remains in the tree.

Example of a skeleton given by `remove` (node `7()`, with "hint" `2()`) in 2-3 tree:
```
d(
  a(1(),2(),3()),
  b(4(),5()),
  c(6(),7()),
) --remove(7;2)-> g(
  e(1(),3()),
  b(4(),5()),
  f(2(),6()),
)
```
Here `e,f,g` are the "new" nodes that form the skeleton.

Another example of a skeleton given by `remove` (node `3()`) in LBBT:
```
b(
  a(1(),2()),
  3()
) --remove(3)-> a(1(),2())
```
Here we have an empty skeleton!

Observe the following properties of a skeleton:
- if a node is in skeleton, then so is its parent node (since "old" node cannot have "new" node as a child);
- as a result, a skeleton is always connected, and contains the root (if nonempty).

We describe the TreeKEM protocol in terms of skeletons.
More specifically, the TreeKEM protocol requires to take a *path decomposition* of the skeleton, i.e., a decomposition of the skeleton into a set of disjoint paths.
We implement both notions in implicit ways:
- For skeleton, we label each node by an *epoch* recording the time/seqno of the operation that generates the node, and by collecting all nodes with the newest epoch one could reconstruct the skeleton.
- For path decomposition, we add a "tracing child" field to each (internal) node, that points to one of its children with the same epoch (or is `null` if no such child exists).
  Note that the skeleton consists of nodes with the same newest epoch. Hence by following the "tracing child" relationship one could effectively follow a path decomposition of the skeleton.
  > We ensure that "tracing child" is `null` *only* if there is no child with the same epoch, and as a result the induced path decomposition is "minimal", meaning that there is no pair of paths in the decomposition that could merge into a longer path.

We make the following particular choices of "tracing child":
> Most of the choices are just unique by definition.
> For those with some freedom, the high-level idea is to (heuristically) form a "long master path" in the induced path decomposition.
- generic `replace`:
  - trace `t'` in `p'`
- all `init`: always trace to the first child in every internal node; this is just an arbitrary choice
- LBBT `append`:
  - trace `l` in `(t, l)`
  - trace `append(tr, l)` in `(tl, append(tr, l))`
- LBBT `truncate`:
  - trace `tr'` in `(tl, tr')` (if `tr' ≠ tr`)
  > Actually if `tr'` is "new".
- BT `addSibling`:
  - trace `s` in `(t', s)`
  - trace `s` in `p'`
  - trace `null` in the split `p'`
  - trace `s` in `ps`
- BT `removeSelf`:
  - trace `s'` in `p'`
  - trace `s'` in `p''`
  - trace `null` in `ps'`
  - trace `p''` in `gp'`
  - trace `s'` in the merged `ps'`
- LLRBT: rather complicated, and for now please refer to the code if interested;
  to remark, the isomorphism does not completely determine the "tracing child" relationship

### Decomposition of "New" Nodes for Reusing "Old" Nodes

MLS has an optimization about reusing (the secrets at) "old" nodes (introduced at version 8).
In tree data structures, we accordingly consider the following task: to find a decomposition (if any) of a "new" node into an "old" node (probably no longer existing in the current tree) along with a list of nodes existing in the current tree, so that their leaves disjointly split the leaves of the "new" node.

We figure out the following particular decomposition opportunities:
- generic "lazy" `add`:
  - for every recursive `replace(t, t')` in `replace(r, l)`, decompose `t'` into `[t,l]`
    > Note that we only care about *true* leaves, so here replacing a lazily removed leaf by a true leaf is essentially adding a leaf.
- LBBT `append`:
  - decompose `(tl, append(tr, l))` into `[t,l]`
- BT `addSibling`:
  - for every recursive `replace(t, t')` in `replace(p, p')`, decompose `t'` into `[t,s*]`, where `s*` is the value of `s` in the first recursion (in the normal case where the first recursion is called for adding a leaf, `s*` would simply be the added leaf)
- BT `removeSelf`:
  - decompose the merged `ps'` into `[ps,…p']`
- LLRBT: induced by the isomorphism; in particular, if a BT node `t` has a decomposition `[t[1], …, t[m]]`, then the LLRBT node `iso(t)` would have a decomposition `[iso(t[1]), …, iso(t[m])]`
  > There is one corner case where `iso(t[1])` is a child node of `iso(t)` (and, e.g., `m = 2` and `iso(t[2])` is the other child), and in this case we exclude the decomposition as `iso(t[1])`, though being an "old" node, is still existing in the current tree and moreover a direct child of the "new" node.

MLS refers to the list of nodes after the "old" node in the decomposition as "unmerged leaves", and we can see that these nodes are indeed leaf nodes in the case of LBBT.
However in general (e.g., see BT) these nodes do not need to be leaf nodes, and thus we refer to them as generally "unmerged nodes".

## TreeKEM

In TreeKEM, users in a group are placed at the leaf nodes in a tree, and each internal node either is *blank* or has a secret (more concretely, a public-secret key pair generated from the secret).
The high-level idea in the TreeKEM protocol is to preserve the following invariant during group changes:
*each user knows and only knows the secrets at the (non-blank) nodes on the path from the user's leaf to the root of the tree.*
As a result, the secret of the root is known by (and only by) every user in the current group, and thus can be used as a shared group secret.
> Strictly speaking, it is insecure to use the secret at the root as the shared group secret, and instead the secret at a "hypothetical parent" of the root is used.

TreeKEM uses a tree data structure `Tree`.
We assume the state of the TreeKEM protocol includes a tree `t`.

> For now our implementation provides operations over a *global* view of the TreeKEM protocol.

Method `init((id[1], pk[1], sk[1]), …, (id[n], pk[n], sk[n]))`:
01. let `t := Tree.init(n)` (with skeleton `t`)
01. write `id[i], pk[i], sk[i]` in the `i`-th leaf, for `i ∈ [n]`
01. `skeletonGen(id[1], t, t)`
    > Here we suppose `id[1]` is the user who initializes the group.

Method `add(id, id', pk', sk')`:
01. let `l` be the leaf for `id`
01. let `l'` be a new leaf, and write `id', pk', sk'` in `l'`
01. let `t' := Tree.add(t, l'; l)`, with skeleton `s`
01. `skeletonGen(id, t', s)`

Method `remove(id, id')`:
01. let `l`, `l'` be the leaves for `id`, `id'`, respectively
01. let `t' := Tree.remove(t, l'; l)`, with skeleton `s`
01. if `s` is empty then `s := {[roof of t']}`
01. `skeletonGen(id, t', s)`

Method `update(id, id' ?= id)`:
01. let `l`, `l'` be the leaves for `id`, `id'`, respectively
01. let `s` be the path from `l'` to the root
01. `skeletonGen(id, t, s)`

All methods above share the subroutine `skeletonGen`, described below.
To recall, the skeletons given by the tree operations and their path decompositions are implemented in implicit ways, so they are not really written down and passed around.

Function `skeletonGen(id, t, s)`:
01. drop leaf nodes from `s`
    > As a corner case, if `s` is empty after dropping all leaf nodes, then one can just (refresh and broadcast by `skeletonEnc` the group secret and) return.
01. let `r` be the path from the leaf for `id` to the root of `t`
01. blank `s \ r`
01. for each path `P[1], …, P[I]` in `s ∩ r`, where `P[i] = (v[i,1], …, v[i,h[i]])`:
    > The nodes in `P[i]` are listed bottom-up; also the paths themselves are sorted bottom-up.
    >
    > Also, we remark that the path decomposition of the skeleton `s` naturally induces a path decomposition of any subset `s ∩ r`.
    > (Here `r` is a path, so `s ∩ r` is a path as well and we actually could take the trivial path decomposition of it; we would have more complex `r` in general.)
    01. sample `seed[i,1]` uniformly at random
    01. for `j ∈ [h[i]]`:
        01. let `(seed[i,j+1], secret) := PRG(seed[i,j])`
        01. let `(pk, sk) := PKE.Gen(secret)`
        01. write `pk, sk` in `v[i,j]`
01. for each `seed[i,j]` at `v[i,j]`:
    01. `skeletonEnc(id, seed[i,j], v[i,j], v[i,j-1])` (if `j = 1` then `v[i,j-1] := null`)
        > Note that `v[i,j] ∈ s ∩ r` is always an internal node, as (1) `s` never contains the leaf node for user `id` (e.g., observe that the part of the skeleton `s` produced by the tree operations never contains the "old" leaf node for user `id`), and (2) `r` never contains any leaf node for users other than `id`.
01. let `seed[I,h[I]+1]` be the group secret
    > Note that the skeleton `s` passed to `skeletonGen` always contains the root of `t`.
    > Also note that `v[I,h[I]]` must be the root of `t` due to the bottom-up sorting.

Function `skeletonEnc(id, seed, v, c*)`:
01. for each child `c` of `v`:
    01. if `c = c*` then continue
    01. if `c` is the leaf for `id` then continue
    01. if `c` is non-blank, i.e., there is `pk` in `c` then `PKE.Enc(pk, seed)`
    01. if `c` is blank then `skeletonEnc(id, seed, c, null)`
        > Note that leaf nodes are always non-blank as they hold the long-term keys for the users. Hence the recursion always gets to an internal node.

### Batching

MLS supports batching operations via a "proposals and commits" mechanism (introduced at version 8).
In particular, for each operation (add/remove/update), the user who issues the operation can choose to only announce a "proposal" describing the operation, without changing the state of the secret tree; a new "commit" operation is introduced, where the committing user collects a couple of proposals announced so far by different users and makes corresponding changes to the secret tree as a batch.

To support "proposals and commits", we make the following changes to the algorithms:
- In `add`/`remove`/`update`: instead of calling `skeletonGen`, just record skeleton `s`
- Method `commit(id)`:
  01. let `s` be the union of all recorded skeletons (while dropping "old" nodes that are no longer existing in the current tree)
  01. `skeletonGen(id, t, s)`

> Note that here the semantics of `add`/`remove`/`update` do not correspond to generating proposals in MLS; instead, they roughly mean "to process the operations indicated by all collected proposals in a commit operation", and `commit` roughly means "to finish the commit operation".

### Optimization: Reuse "Old" Secrets

Using the *decomposition of "new" nodes for reusing "old" nodes*, we have an optimization that saves blanks in the protocol.

Function `recompose(v)`:
01. if `v` has no *decomposition for reusing "old" nodes* then return
01. let `[v[1], …, v[m]]` be the decomposition of `v`
01. if `v[1]` has no secret then `recompose(v[1])`
01. if `v[1]` now has secrets:
    01. copy secrets at `v[1]` to `v`
    01. set "unmerged nodes" at `v` to be "unmerged nodes" at `v[1]` along with `[v[2], …, v[m]]`

We then make the following changes to the algorithms:
- In `skeletonGen`:
  - for each `v ∈ s \ r`, besides blanking, also apply `recompose(v)`
  - (set "unmerged nodes" to be `[]` for freshly generated secrets)
- In `skeletonEnc`:
  - besides `PKE.Enc(pk, seed)`, if there are "unmerged nodes" `[c[1], …, c[m]]` at `c` then `skeletonEnc(id, seed, v*, null)`, for a virtual node `v* := (c[1], …, c[m])` collecting the "unmerged nodes" as children

### Generalization: Secret Region and Tainting

As a generalization, we replace the *paths* in the invariant with general *secret regions*; the generalized invariant is now:
*each user knows and only knows the secrets at the (non-blank) nodes **in the user's secret region**.*
For ease of the (generalized) algorithms, we restrict that a user's secret region must at least include the path from the user's leaf to the root of the tree, and must not include other users' leaves.
Under this restriction, it is sometimes more convenient to speak about the *additional secret region*, which excludes the path.

The actual secret regions in the algorithms are determined by a *secret region strategy*, which we denote by `region(user, node) -> Boolean`, meaning whether `user`'s *additional* secret region includes `node`;
it is plausible that the actual secret region strategy wants more information from the protocol, and one can easily adapt the interface to the demands.
Moreover, we actually have two independent secret region strategies in the algorithm, and we name the two as `regionGen` and `regionEnc`; the reason behind the naming would be obvious in the context.

Accordingly, each (internal) node keeps track of the "tainting" users whose *additional* secret regions include that node.
A node is called *tainted* if it has non-empty "tainting" user set.

The algorithms generalize as follows.
- In `remove` and `update`:
  - add the *additional* secret region of `id'` to `s`; moreover, the nodes should be added in a "path-/parent-closed" way, such that for every `v ∈ s`, we have `parent(v) ∈ s` as well
    (for `remove`, only add the nodes that still exist in the current tree)
    > Note that this way, the skeleton `s` after adding the nodes must still be connected.
- In `skeletonGen`:
  - `r` now consists of the path `p` for user `user := id` along with the additional secret region of `user`
  - whether `v ∈ s \ r` or is part of `s ∩ r` is decided by whether `v ∈ s \ p ∧ ¬regionGen(user, v)`
  - (after blanking `v ∈ s \ r`, `v` is no longer tainted)
  - for each `v[i,j] ∈ s ∩ r` with freshly generated secrets, if (and only if) `v[i,j] ∈ s \ p` then `v[i,j]` is considered tainted by `user`
  - for each `v[i,j]`, for each other user `user'` with public key `pk'` (at the leaf for `user'`), if `regionEnc(user', v)` then `PKE.Enc(pk', seed[i,j])`, and `v[i,j]` is (also) tainted by `user'`
    > It would be inefficient to iterate over all users and check if `regionEnc(user', v)` is satisfied, and one needs to build extra data structure in `regionEnc` for (approximately) generating the satisfying users.
- When combining with the "unmerged nodes" optimization, in `recompose`:
  - inherit the "tainting" users when copying secrets

It can be verified that the above changes become no-op if additional secret region is always empty (i.e., if `regionEnc` and `regionDec` always return `false`).

### Optimization: Use OTP instead of PKE when Possible

It is possible (especially when the additional secret region is nonempty) to replace a couple of PKE encryptions by *one-time pads* (OTPs) in `skeletonEnc`, which helps improve efficiency.

To enable OTP, we make the following changes to the algorithms:
- In `skeletonEnc`:
  - if `c` is the top of a path `P[i]` in `skeletonGen`, which means there is a generated but unused `seed[i,h[i]+1]` in `skeletonGen`, then `OTP.Enc(seed[i,h[i]+1], seed)` instead of `PKE.Enc(pk, seed)`

> Following the OTP optimization, every tail value `seed[i,h[i]+1]` will be used (recall that previously only the topmost one `seed[I,h[I]+1]` is used, as the new group secret).
> In this sense, it seems more natural for the algorithm to include the OTP optimization.

### Optimization: Use SKE instead of PKE when Possible

PKE encryptions are commonly orders of magnitudes slower than SKE encryptions.
Hence when the space is not a big concern, it would be valuable if one can replace PKE encryptions by SKE encryptions in cost of storing extra SKE keys.

To enable the replacing, we make the following changes to the algorithms:
- In `skeletonGen`:
  - for each `v[i,j] ∈ s ∩ r` with freshly generated secrets, PRG-expand further by `(seed[i,j+1], secret, secret') := PRG(seed[i,j])` instead, generate SKE key `k := SKE.Gen(secret')`, and write `k` in `v[i,j]` as well
- In `skeletonEnc`:
  - before checking for `pk`, if `c` is non-blank and has SKE key `k` *and `c` is in the secret region of `id`* then `SKE.Enc(k, seed)` (and return)
    > Here we write in terms of general secret regions; to remark, this optimization is (almost) useless (and merely wastes space for storing SKE keys) if the secret regions are just paths.
    <!---->
    > Note that when combining with the "unmerged nodes" optimization, one still needs to recurse in this branch if there are "unmerged nodes" at `c`.

It can be observed that regarding the running time, this optimization will:
- replace some of the PKE encryptions *1:1* by SKE encryptions
- use longer PRG expansions (from double to triple length)
- introduce SKE key generations, the number of which is the same as existing PKE key generations

Alternatively, since the used SKE key is always in the secret region, one could make the SKE key generations lazy and, e.g., derive the SKE key `k` from the PKE secret key `sk` when `k` is needed.
This way there is no longer the space (or PRG) overhead, and the SKE key generation overhead is bound to the number of SKE encryptions instead of PKE key generations.
> A caveat for the alternative approach is that it may hurt the *forward secrecy* (FS) of the protocol.
> To achieve the strongest notion of FS requires to use *updatable* PKE (and updatable SKE), and if the lazy SKE key generation does not refresh the underlying `sk` then the strongest FS would break.

### [Archaic] TreeKEM strategies preceding the notion of skeletons

The following TreeKEM strategies are obsolete and no longer supported in the latest codes.
They are either considered inefficient variants, or superseded by more general optimizations.

- add strategy:
  - "sync": normal behavior
  - "async": just blank out instead of `skeletonGen`
    > Caveat: for complete functionality, one would need to at least `skeletonGen` at the root in order to get a (new) group secret.
    > (Note that due to the blanks, this new secret at the root would be rather expensive to broadcast in `skeletonEnc` though.)
    > (More strictly, as remarked before, we really mean the secret at a "hypothetical parent" of the root.)
- remove strategy:
  - "remover": blank out the path from removee, remove from the tree, and then "update" (which is roughly `skeletonGen`, while with a potentially larger skeleton that adds the path from remover); equivalent to normal behavior (as the nodes on the blanked-out path, if still existing in the tree, are always contained in the skeleton of the remove operation), while with the potentially larger skeleton
    > The strategies were designed before introducing the notion of skeletons, so here the blanked-out path for `skeletonGen` should be interpreted as the "new" nodes that "overlay" the "old" blanked-out path.
    > (Technically, a "new" node created by the function `replace` is regarded as "overlaying" the corresponding replaced "old" node.)
  - "remover-before": blank out the path from removee, "update" (roughly `skeletonGen`, for the blanked-out path), and then remove from the tree; equivalent to `skeletonGen` while excluding the nodes not "overlaying" some "old" nodes from the (potentially larger) skeleton
    > Same caveat about blanking, in the corner case where all nodes in the skeleton get excluded.
  - "removee": "update" (meaninglessly), blank out the path from removee, and then remove from the tree; equivalently, just blank out instead of `skeletonGen`
    > Same caveat about blanking.
- update strategy:
  - "LCA": normal behavior
  - "root": just blank out instead of `skeletonGen`
    > Same caveat about blanking.
- merge strategy:
  - "blank": normal behavior (without the "unmerged nodes" optimization)
  - "keep": keep a "partial secret" at certain nodes when "merging" nodes; superseded by the "unmerged nodes" optimization, with in particular the decomposition in BT `removeSelf`
- split strategy:
  - "blank": normal behavior (without the "unmerged nodes" optimization)
  - "keep": keep a "partial secret" at certain *grandparent* nodes when "splitting" nodes; superseded by the "unmerged nodes" optimization, with in particular the decomposition in BT `addSibling`

## References

- MLS: <https://messaginglayersecurity.rocks>
  - MLS version 8: <https://datatracker.ietf.org/doc/draft-ietf-mls-protocol/08/>
    ;
    diff: <https://author-tools.ietf.org/iddiff?url1=draft-ietf-mls-protocol-07&url2=draft-ietf-mls-protocol-08&difftype=--html>
- Tainted TreeKEM: <https://eprint.iacr.org/2019/1489>
- Multicast Key Agreement: <https://eprint.iacr.org/2021/1570>
