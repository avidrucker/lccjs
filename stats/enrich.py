#!/usr/bin/env python3
"""Enrich docs/puzzle-velocity.csv with git churn, GitHub issue timestamps,
and notes-parsed flags, writing stats/puzzle-velocity-enriched.csv.

Three enrichment sources (per the brainstorm in stats/README.md):

  1. Git churn   — from `closed_commit`. `git show --numstat` gives
                   insertions / deletions / files touched. Commits that
                   close cross-repo (the Claude-skill tickets land in
                   avidrucker/claude-config) won't resolve here, so those
                   rows get NaN churn + cross_repo=True — itself a signal.

  2. GitHub issue times — `gh api repos/avidrucker/lccjs/issues/<n>` gives
                   created_at (backlog age before work started = LEAD time)
                   and closed_at (~ commit/push time). Lets us separate
                   lead time from the hands-on cycle time in actual_min.

  3. Notes-parsed flags — worktree / overrun / test-loop / retro-C, scraped
                   from the free-text notes column, plus derived ratios.

The script degrades gracefully: if git or gh is unavailable/offline it
leaves those columns blank rather than failing, so the notebook can always
re-run against whatever the last good enrichment produced.

Usage:  python3 stats/enrich.py   (run from repo root or anywhere)
"""

from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_CSV = REPO_ROOT / "docs" / "puzzle-velocity.csv"
OUT_CSV = REPO_ROOT / "stats" / "puzzle-velocity-enriched.csv"
GH_REPO = "avidrucker/lccjs"


def _run(cmd: list[str]) -> tuple[int, str]:
    """Run a command, return (returncode, stdout). Never raises."""
    try:
        p = subprocess.run(
            cmd, cwd=REPO_ROOT, capture_output=True, text=True, timeout=30
        )
        return p.returncode, p.stdout
    except (OSError, subprocess.SubprocessError):
        return 127, ""


def git_churn(sha: str) -> dict:
    """Return insertions/deletions/files/net for a commit, or NaNs if the
    SHA doesn't resolve in this repo (cross-repo close)."""
    blank = {
        "insertions": "",
        "deletions": "",
        "files_changed": "",
        "net_loc": "",
        "total_loc": "",
        "commit_date": "",
        "cross_repo": "",
    }
    if not sha:
        return blank

    code, _ = _run(["git", "cat-file", "-t", sha])
    if code != 0:
        # SHA not in this repo → the work was committed elsewhere.
        out = dict(blank)
        out["cross_repo"] = "true"
        return out

    # Commit author date (ISO).
    _, date_out = _run(["git", "show", "-s", "--format=%aI", sha])
    commit_date = date_out.strip().splitlines()[0] if date_out.strip() else ""

    # --numstat with an empty --format suppresses the header so we only get
    # "<added>\t<deleted>\t<path>" lines. Binary files report "-\t-".
    _, num_out = _run(["git", "show", "--numstat", "--format=", sha])
    ins = dele = files = 0
    for line in num_out.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        a, d, _path = parts
        files += 1
        if a.isdigit():
            ins += int(a)
        if d.isdigit():
            dele += int(d)

    return {
        "insertions": ins,
        "deletions": dele,
        "files_changed": files,
        "net_loc": ins - dele,
        "total_loc": ins + dele,
        "commit_date": commit_date,
        "cross_repo": "false",
    }


def gh_issue_times(number: str) -> dict:
    """Return created_at / closed_at for a GitHub issue, blank on miss."""
    blank = {"issue_created": "", "issue_closed": ""}
    if not number or not number.strip().isdigit():
        return blank
    code, out = _run(
        [
            "gh",
            "api",
            f"repos/{GH_REPO}/issues/{number.strip()}",
            "--jq",
            "{c: .created_at, x: .closed_at}",
        ]
    )
    if code != 0 or not out.strip():
        return blank
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return blank
    return {
        "issue_created": data.get("c") or "",
        "issue_closed": data.get("x") or "",
    }


# --- notes-parsed flags -------------------------------------------------- #
_WORKTREE_RE = re.compile(r"worktree", re.I)
_OVERRUN_RE = re.compile(r"overr[au]n|over[- ]?ran|FIRST OVERRUN", re.I)
_TESTLOOP_RE = re.compile(r"test[- ]?loop|edit/test|assemble/run/diff|test loop", re.I)
_RETROC_RE = re.compile(r"\bC set retro\b|retro \(no formal C\)|C set retro", re.I)
_CROSSREPO_NOTE_RE = re.compile(r"cross-repo", re.I)


def notes_flags(notes: str) -> dict:
    n = notes or ""
    return {
        "f_worktree": "true" if _WORKTREE_RE.search(n) else "false",
        "f_overrun": "true" if _OVERRUN_RE.search(n) else "false",
        "f_test_loop": "true" if _TESTLOOP_RE.search(n) else "false",
        "f_retro_c": "true" if _RETROC_RE.search(n) else "false",
        "f_crossrepo_note": "true" if _CROSSREPO_NOTE_RE.search(n) else "false",
    }


def _parse_iso(s: str):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _minutes_between(a: str, b: str):
    """Minutes from ISO a to ISO b (b - a), or '' if either missing."""
    da, db = _parse_iso(a), _parse_iso(b)
    if da is None or db is None:
        return ""
    return round((db - da).total_seconds() / 60.0, 2)


def _to_float(s: str):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def main() -> int:
    if not SRC_CSV.exists():
        print(f"error: {SRC_CSV} not found", file=sys.stderr)
        return 1

    with SRC_CSV.open(newline="") as fh:
        rows = list(csv.DictReader(fh))

    print(f"enriching {len(rows)} rows from {SRC_CSV.relative_to(REPO_ROOT)} ...")

    extra_cols = [
        # git churn
        "insertions",
        "deletions",
        "files_changed",
        "net_loc",
        "total_loc",
        "commit_date",
        "cross_repo",
        # github issue times
        "issue_created",
        "issue_closed",
        # notes flags
        "f_worktree",
        "f_overrun",
        "f_test_loop",
        "f_retro_c",
        "f_crossrepo_note",
        # derived
        "c_ratio",
        "h_ratio",
        "span_min",
        "lead_min",
    ]

    for i, row in enumerate(rows, 1):
        sha = (row.get("closed_commit") or "").strip()
        ticket = (row.get("ticket") or "").strip()

        row.update(git_churn(sha))
        row.update(gh_issue_times(ticket))
        row.update(notes_flags(row.get("notes", "")))

        # Derived metrics.
        c = _to_float(row.get("c_min"))
        h = _to_float(row.get("h_min"))
        actual = _to_float(row.get("actual_min"))
        row["c_ratio"] = round(c / actual, 3) if c and actual else ""
        row["h_ratio"] = round(h / actual, 3) if h and actual else ""
        row["span_min"] = _minutes_between(
            row.get("started_iso", ""), row.get("finished_iso", "")
        )
        # Lead time: issue filed → work started (backlog wait).
        row["lead_min"] = _minutes_between(
            row.get("issue_created", ""), row.get("started_iso", "")
        )

        tag = "cross-repo" if row.get("cross_repo") == "true" else f"+{row['total_loc']} loc"
        print(f"  [{i:>2}/{len(rows)}] #{ticket:<4} {tag}")

    fieldnames = list(rows[0].keys()) if rows else []
    for c in extra_cols:
        if c not in fieldnames:
            fieldnames.append(c)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"\nwrote {OUT_CSV.relative_to(REPO_ROOT)} ({len(rows)} rows, {len(fieldnames)} cols)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
