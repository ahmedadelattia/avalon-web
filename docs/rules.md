# Avalon Rules Document

## Canonical Rules
- Supports 5-10 players.
- Good wins after 3 successful quests unless Merlin is assassinated.
- Evil wins with 3 failed quests, correct Merlin assassination, or 5 consecutive rejected team proposals.
- Team proposal votes are public per-player after everyone votes.
- Quest votes are secret per-player; only aggregate fail count is revealed.
- Quest 4 requires 2 fails to fail only in 7+ player games.

## Player Matrix
| Players | Good | Evil | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 5 | 3 | 2 | 2 | 3 | 2 | 3 | 3 |
| 6 | 4 | 2 | 2 | 3 | 4 | 3 | 4 |
| 7 | 4 | 3 | 2 | 3 | 3 | 4 | 4 |
| 8 | 5 | 3 | 3 | 4 | 4 | 5 | 5 |
| 9 | 6 | 3 | 3 | 4 | 4 | 5 | 5 |
| 10 | 6 | 4 | 3 | 4 | 4 | 5 | 5 |

## Optional Role Mechanics
- Mordred: evil, hidden from Merlin.
- Oberon: evil, isolated from evil knowledge.
- Morgana: appears as Merlin to Percival.
- Percival: sees Merlin (+ Morgana if enabled).
- Lady of the Lake: used after quests 2, 3, and 4; cannot inspect prior holder.

## House Rule (Product Requirement)
Default assassination mode is `evil_confirm_majority_excl_oberon`:
- Assassin nominates suspect.
- Connected evil players except Oberon vote confirm/reject.
- Timeout/non-vote counts as reject.
- Confirmation passes only when `confirm > reject`.
- Tie or failed confirmation means Good wins.

Alternative mode `official`:
- Assassin nomination resolves immediately.
