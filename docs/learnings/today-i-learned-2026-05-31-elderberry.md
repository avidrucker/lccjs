# Today I Learned — 2026-05-31 (ELDERBERRY)

Full-day session closing out the 16-issue notebook quality cluster (#329) for
`stats/day-four-analysis.ipynb`. Every fix was a WRITER or DATA task — no production
code, just prose clarity, statistical honesty, and notebook structure. The surprises were
mostly procedural: swapped marker numbers from parallel filing, a duplicate-cell trap
from a script that writes before asserting, and a DEV bug (#348) that turned out to
already be fixed.

## 1. Parallel `gh issue create` background jobs assign numbers by arrival, not submission order — markers get the wrong issue numbers

The original tracker (#329) was filed with 16 child issues created in parallel background
jobs. The jobs finished in a different order than they were submitted, so the marker
numbers in the notebook (`@todo #331`, `@todo #332`, etc.) got mis-assigned: what the
notebook called #331 (the §5 fix) was actually #332 on GitHub, and vice versa. Five more
swaps appeared across the session as more markers were cross-checked.

**The reliable fix:** before trusting any `@todo #N` marker, run `gh issue view N` and
compare its title against what the marker's comment says. The GitHub issue title is the
source of truth; the in-code marker number is a claim that can be wrong. When a swap is
found, correct both sides in one commit: rename the stale label and remove or relabel the
resolved one. Don't file a separate PM ticket per swap — that manufactures churn. Fix it
inline where the work is already happening.

## 2. When a notebook-editing script writes the file before the assertion fails, the partial state is already on disk — re-running inserts duplicates

In #337 (adding five "Read —" interpretation cells), the script inserted the cells and
called `json.dump()`, then ran a post-write assertion that failed (because I searched for a
literal em dash in JSON-escaped output). I re-ran the script assuming it had done nothing.
It had done everything — twice. The result was 10 Read cells (5 pairs of duplicates).

**The reliable fix:** when a script's verification logic uses a string that might be
unicode-escaped in JSON (`—` → `—`), test against the *parsed* Python objects, not
against the raw JSON string. More generally: after a script writes a file and then fails,
always inspect the file's current state (`len(nb['cells'])`, count of target cells) before
re-running the mutation. A failed assertion does not mean a failed write.

## 3. A full marker audit at the start of a cluster prevents shipping a notebook with pointers to closed issues

After several worktrees had landed, a `@todo #340` marker was still sitting in cell 13
of the notebook even though #340 was closed (the hardcoded H/p values it had pointed to
were already removed in #333, making the task moot). Without an upfront audit it would
have been committed as-is.

**The reliable fix:** before starting a multi-issue cluster on a notebook, run a single
audit pass — `re.findall(r'@todo #(\d+)', raw)` against the current file — and cross-check
each marker number against `gh issue view N`. Stale markers for closed issues are noise
that makes the notebook look like it has pending work when it doesn't. Clean them as part
of the first commit that touches the file.

## 4. "Not significant" and "uninformative" are not synonyms — the Spearman n=4 case

The §2 output printed "→ No statistically significant monotone trend (p ≥ 0.05)." That
phrasing implies the question was answered (negatively). With n=4 day-buckets, Spearman
has approximately 5% power — it would fail to detect almost any real trend. p=0.60 with
n=4 is not evidence of no trend; it is a result that carries essentially no information
either way.

**The write:** the fixed output now distinguishes: "No trend *detected* (p ≥ 0.05). ⚠
Underpowered: with only N day-buckets, the test has ~5% power — this result is
uninformative, not a negative finding. Revisit at n ≥ 10." The pattern generalises: any
time a non-significant result with a small n is reported, the honest caveat is
"uninformative" not "null." The sample size, not the p-value, is the primary signal about
what the test can say.

## 5. Close script SHA rewrite is a known failure mode — it is not a real close failure

On #333, `npm run close` printed "push reported success but SHA is NOT on origin/main —
refusing to remove the worktree." The issue was already closed on GitHub (the `Closes #333`
keyword had landed), the commit was on origin/main under a *new* SHA (the rebase rewrote
it), and the worktree was already gone. The guard checked the pre-rebase SHA and correctly
refused teardown — but the work was fine.

**The pattern:** when `npm run close` fires the SHA gate, check `git log --oneline
origin/main -3` first. If the commit message is there under a different SHA, the close
succeeded; clean up manually (`git worktree prune`, `git branch -D`). This is #350, a
known open issue — the guard stores the SHA before the push loop, which rebases and
rewrites it. The teardown gate then checks a stale identifier. Until #350 is fixed, treat
"SHA not on origin/main" after a successful push as a rebase-rewrite signal, not a real
failure.
