#!/usr/bin/env bash
#
# install-skills.sh — symlink lccjs's repo-local Claude skills into the Claude
# Code discovery path (~/.claude/skills/), so the ISA-domain skills that ship
# WITH this repo are usable globally on the machine.
#
# Background (#1585): lccjs-assembly and lccplus-assembly are intrinsically
# lccjs-specific — they encode the LCC / LCC+ ISA — so they live committed in
# THIS repo under .agents/skills/, not in the general claude-config repo. This
# installer surfaces them into ~/.claude/skills/ via per-skill symlinks, the
# same mechanism claude-config uses, so the on-disk copy stays the single
# source of truth and editing it updates the runtime in place.
#
# Idempotent. A ~/.claude/skills/<name> entry that is:
#   - absent            → linked
#   - a symlink (to us or elsewhere) → (re)pointed at this repo's copy
#   - a real file/dir   → left alone with a WARN (pass --force to replace)
#
# Usage:
#   bash scripts/install-skills.sh            # symlink (default)
#   bash scripts/install-skills.sh --dry-run  # show what would change
#   bash scripts/install-skills.sh --force    # replace a real (non-symlink) target
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$REPO_ROOT/.agents/skills"
CLAUDE_SKILLS="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

DRY_RUN=false
FORCE=false
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --force)   FORCE=true ;;
        *) echo "Unknown arg: $arg" >&2; exit 1 ;;
    esac
done

echo
echo "lccjs skill installer"
echo "  Repo:        $REPO_ROOT"
echo "  Source:      $SRC_DIR"
echo "  Target root: $CLAUDE_SKILLS"
echo "  Mode:        symlink$([ "$DRY_RUN" = true ] && echo ' (dry-run)' || true)"
echo

if [ ! -d "$SRC_DIR" ]; then
    echo "  No .agents/skills/ in this repo — nothing to install." >&2
    exit 0
fi

[ "$DRY_RUN" = false ] && mkdir -p "$CLAUDE_SKILLS"

for skill_dir in "$SRC_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    source="${skill_dir%/}"
    name="$(basename "$source")"
    target="$CLAUDE_SKILLS/$name"

    if [ -L "$target" ]; then
        if [ "$(readlink "$target")" = "$source" ]; then
            echo "  [skip] $name (already linked here)"
            continue
        fi
        # A symlink pointing elsewhere (e.g. the old claude-config copy): a link
        # is just a pointer, so repointing it is safe and is the intended move.
        if [ "$DRY_RUN" = true ]; then
            echo "  [dry] would repoint $name (was → $(readlink "$target"))"
            continue
        fi
        ln -snf "$source" "$target"
        echo "  [repoint] $name"
        continue
    fi

    if [ -e "$target" ]; then
        # A real file/dir, not a symlink — do not clobber without --force.
        if [ "$FORCE" = true ]; then
            if [ "$DRY_RUN" = true ]; then
                echo "  [dry] would replace real path $name"
                continue
            fi
            rm -rf "$target"
            ln -snf "$source" "$target"
            echo "  [replace] $name"
        else
            echo "  [WARN] $target exists and is NOT a symlink — left alone."
            echo "         Move it aside, or rerun with --force to replace it."
        fi
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "  [dry] would link $name"
        continue
    fi
    ln -snf "$source" "$target"
    echo "  [link] $name"
done

echo
echo "Done. Verify with:  ls -l $CLAUDE_SKILLS | grep -E 'lccjs-assembly|lccplus-assembly'"
echo
