#!/usr/bin/env python3
"""Enrich the velocity log with git churn, GitHub issue timestamps,
and notes-parsed flags, writing stats/puzzle-velocity-enriched.csv.

Data source: ~/.lccjs/lccjs.db (SQLite — seeded by npm run velocity:seed).
Reads all rows from the `velocity` table; schema is always valid, so no
field-count crashes are possible. Falls back gracefully when git or gh is
unavailable (those columns are left blank).

Three enrichment layers:

  1. Git churn   — from `closed_commit`. `git show --numstat` gives
                   insertions / deletions / files touched. Cross-repo
                   closes (e.g. avidrucker/claude-config skill tickets)
                   won't resolve here → NaN churn + cross_repo=True.

  2. GitHub issue times — `gh api repos/avidrucker/lccjs/issues/<n>` gives
                   created_at and closed_at, enabling lead-time analysis.

  3. Notes-parsed flags — worktree / overrun / test-loop / retro-C, scraped
                   from the free-text notes column, plus derived ratios.

Usage:  python3 stats/enrich.py   (run from repo root or anywhere)
        Precondition: ~/.lccjs/lccjs.db must exist (npm run velocity:seed).
        Refresh after any new velocity rows are logged.
"""

from __future__ import annotations

import csv
import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH   = Path.home() / ".lccjs" / "lccjs.db"
OUT_CSV   = REPO_ROOT / "stats" / "puzzle-velocity-enriched.csv"
TMP_CSV   = OUT_CSV.with_suffix(".csv.tmp")
GH_REPO   = "avidrucker/lccjs"


def _run(cmd: list[str]) -> tuple[int, str]:
    """Run a command, return (returncode, stdout). Never raises."""
    try:
        p = subprocess.run(
            cmd, cwd=REPO_ROOT, capture_output=True, text=True, timeout=30
        )
        return p.returncode, p.stdout
    except (OSError, subprocess.SubprocessError):
        return 127, ""


def git_churn(sha: str | None) -> dict:
    """Return insertions/deletions/files/net for a commit, or blanks if the
    SHA doesn't resolve in this repo (cross-repo close or empty)."""
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
        out = dict(blank)
        out["cross_repo"] = "true"
        return out

    _, date_out = _run(["git", "show", "-s", "--format=%aI", sha])
    commit_date = date_out.strip().splitlines()[0] if date_out.strip() else ""

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


def gh_issue_times(ticket) -> dict:
    """Return created_at / closed_at for a GitHub issue, blank on miss."""
    blank = {"issue_created": "", "issue_closed": ""}
    if ticket is None:
        return blank
    number = str(int(ticket)) if isinstance(ticket, (int, float)) else str(ticket).strip()
    if not number.isdigit():
        return blank
    code, out = _run([
        "gh", "api",
        f"repos/{GH_REPO}/issues/{number}",
        "--jq", "{c: .created_at, x: .closed_at}",
    ])
    if code != 0 or not out.strip():
        return blank
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return blank
    return {
        "issue_created": data.get("c") or "",
        "issue_closed":  data.get("x") or "",
    }


# --- notes-parsed flags ---
_WORKTREE_RE       = re.compile(r"worktree",                              re.I)
_OVERRUN_RE        = re.compile(r"overr[au]n|over[- ]?ran|FIRST OVERRUN", re.I)
_TESTLOOP_RE       = re.compile(r"test[- ]?loop|edit/test|assemble/run/diff|test loop", re.I)
_RETROC_RE         = re.compile(r"\bC set retro\b|retro \(no formal C\)|C set retro", re.I)
_CROSSREPO_NOTE_RE = re.compile(r"cross-repo",                            re.I)


def notes_flags(notes: str | None) -> dict:
    n = notes or ""
    return {
        "f_worktree":      "true" if _WORKTREE_RE.search(n)       else "false",
        "f_overrun":       "true" if _OVERRUN_RE.search(n)        else "false",
        "f_test_loop":     "true" if _TESTLOOP_RE.search(n)       else "false",
        "f_retro_c":       "true" if _RETROC_RE.search(n)         else "false",
        "f_crossrepo_note":"true" if _CROSSREPO_NOTE_RE.search(n) else "false",
    }


# Project timezone (HST, UTC−10) — the velocity analysis buckets in HST, so a
# timestamp logged without an offset is assumed project-local. Attaching it makes
# every parsed datetime tz-aware, so rows mixing naive and aware stamps subtract
# cleanly instead of raising "can't subtract offset-naive and offset-aware" (#1212).
_HST = timezone(timedelta(hours=-10))


def _parse_iso(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:  # tz-naive stamp → assume project-local HST
        dt = dt.replace(tzinfo=_HST)
    return dt


def _minutes_between(a, b):
    da, db = _parse_iso(a), _parse_iso(b)
    if da is None or db is None:
        return ""
    return round((db - da).total_seconds() / 60.0, 2)


def _to_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main() -> int:
    if not DB_PATH.exists():
        print(
            f"error: {DB_PATH} not found — run `npm run velocity:seed` first",
            file=sys.stderr,
        )
        return 1

    # Read all rows from SQLite — schema guarantees field validity.
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    raw_rows = con.execute("SELECT * FROM velocity ORDER BY id").fetchall()
    con.close()

    col_names = list(raw_rows[0].keys()) if raw_rows else []
    rows = [dict(r) for r in raw_rows]  # mutable dicts for enrichment

    print(f"enriching {len(rows)} rows from {DB_PATH} ...")

    extra_cols = [
        "insertions", "deletions", "files_changed", "net_loc", "total_loc",
        "commit_date", "cross_repo",
        "issue_created", "issue_closed",
        "f_worktree", "f_overrun", "f_test_loop", "f_retro_c", "f_crossrepo_note",
        "c_ratio", "h_ratio", "span_min", "lead_min",
    ]

    for i, row in enumerate(rows, 1):
        sha    = row.get("closed_commit") or ""
        ticket = row.get("ticket")

        row.update(git_churn(sha))
        row.update(gh_issue_times(ticket))
        row.update(notes_flags(row.get("notes")))

        c      = _to_float(row.get("c_min"))
        h      = _to_float(row.get("h_min"))
        actual = _to_float(row.get("actual_min"))
        row["c_ratio"]  = round(c / actual, 3) if c and actual else ""
        row["h_ratio"]  = round(h / actual, 3) if h and actual else ""
        row["span_min"] = _minutes_between(row.get("started_iso"), row.get("finished_iso"))
        row["lead_min"] = _minutes_between(row.get("issue_created"), row.get("started_iso"))

        tag = "cross-repo" if row.get("cross_repo") == "true" else f"+{row['total_loc']} loc"
        print(f"  [{i:>3}/{len(rows)}] #{str(ticket):<4}  {tag}")

    # Build fieldnames: original DB columns + enrichment columns.
    fieldnames = list(col_names)
    for c in extra_cols:
        if c not in fieldnames:
            fieldnames.append(c)

    # Atomic write: build in TMP, then os.replace into place.
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with TMP_CSV.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    os.replace(TMP_CSV, OUT_CSV)
    print(f"\nwrote {OUT_CSV.relative_to(REPO_ROOT)} ({len(rows)} rows, {len(fieldnames)} cols)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
