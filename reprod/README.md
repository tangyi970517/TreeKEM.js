# Reproducing Previous Works

## Tainted TreeKEM

> Klein, Pascual-Perez, Walter, Kamath, Capretto, Cueto, Markov, Yeo, Alwen, Pietrzak
> \
> "Keep the Dirt: Tainted TreeKEM, Adaptively and Actively Secure Continuous Group Key Agreement"
> \
> S&P 2021; [ia.cr/2019/1489](https://eprint.iacr.org/2019/1489)

Common setup:
- tree: LBBT, perfect mode, add at leftmost "removed" leaf (if any)
- region: for tainting (`tainted`), it is equivalent to using the entire tree as `regionGen` (and still paths as `regionEnc`)
- protocol: turn off "unmerged nodes" optimization
- simulation:
  - initialize with `2^{i-1}` users, and run `10 * 2^i` operations, for `i = 3, …, 15`
  - 10% add, 10% remove, 80% update
  - add/remove issued by a random user (if not specified otherwise)
  - choose a random user to remove/update
  - always commit immediately after each operation (by the user who issues the operation)
- 3 schemes:
  01. `TKEM`: normal, but no commit after add/remove
  01. `TKEM_commit`: normal
      > It is claimed that the performance of normal TreeKEM under arbitrary commit scheduling lies between the performance of `TKEM` and `TKEM_commit`, but this is maybe just heuristic, as different commit scheduling would result in different distribution of blank nodes and it is hard to argue about the performance rigorously.
  01. `tainted`: use tainting

Experiment 1: administrator setting
- introduce `max(2^{i-1}/64, 1)` number of administrators
- add/remove issued by a random administrator
  > Guess: the set of administrators is not dynamically changing with the current user number, and administrators are never removed.
- figures: the following as function of "tree size" `2^i`
  01. average number of encryptions per non-admin
  01. average number of encryptions per admin
  01. average number of encryptions per user

Experiment 2: non-administrative setting
- 2 distributions for choosing user to update:
  01. normal, uniform distribution
  01. Zipf distribution: user with *ranking* `k` has weight `1/k` to be chosen
      > Guess: users are ranked by a hidden variable, say assigned by `random()`.
- figures: average number of encryptions per user as function of "tree size" `2^i`, for the 2 distributions
