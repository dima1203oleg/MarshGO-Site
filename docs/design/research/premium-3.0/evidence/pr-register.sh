#!/usr/bin/env bash
# PR register for the Premium 3.0 audit.
#
# READ-ONLY: every gh call here is a `view`/`list` query. Nothing is created,
# closed, commented on, or merged.
#
# Usage:  ./pr-register.sh [out-file]
# The output is the raw evidence the FEATURE_PARITY doc is written from; it is
# committed next to this script so a reader can re-run it and diff.
set -euo pipefail

OUT="${1:-$(dirname "$0")/pr-register.txt}"
REV="${2:-}"   # optional: annotate that the register was read at this local rev

# A "zone" is the first two path segments of a changed file — enough to see
# whether two PRs touch the same part of src/, without dumping every filename.
zone_of() {
  awk -F/ '{ if (NF==1) print $1; else print $1"/"$2 }'
}

pr_block() { # repo number
  local repo="$1" n="$2"
  gh pr view "$n" --repo "$repo" \
    --json number,state,baseRefName,headRefName,mergeable,isDraft,updatedAt,additions,deletions,changedFiles,files \
    2>/dev/null |
  jq -r '
    "PR \(.number)  [\(.state)]  draft=\(.isDraft)  mergeable=\(.mergeable)",
    "  base: \(.baseRefName)",
    "  head: \(.headRefName)",
    "  updated: \(.updatedAt)   changed=\(.changedFiles)  +\(.additions)/-\(.deletions)",
    "  zones:",
    (.files | group_by((.path | split("/") | if length > 2 then .[0:2] else [.[0]] end | join("/")))
      | map("    \(length) file(s)  \(.[0].path | split("/") | if length > 2 then .[0:2] else [.[0]] end | join("/"))")
      | sort | .[])
  '
  echo
}

{
  echo "# PR register (read-only gh queries)"
  echo "# generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  [ -n "$REV" ] && echo "# local rev annotation: $REV"
  echo

  echo "########################## MarshGO-Site ##########################"
  for n in 50 49 48 47 46 45 44 43 42 41 40 39 38 37 36 35 34 33 32 31 30 29; do
    echo "----- Site #$n -----"
    pr_block dima1203oleg/MarshGO-Site "$n"
  done

  echo "########################## MarshGO-Server ##########################"
  for n in 76 75 74 73 72 71 70 69 68 67 66 65 64 63 62; do
    echo "----- Server #$n -----"
    pr_block dima1203oleg/MarshGO-Server "$n"
  done

  echo "########################## MarshGO (root) ##########################"
  for n in 14 13 12 11 10 9 8; do
    echo "----- Root #$n -----"
    pr_block dima1203oleg/MarshGO "$n"
  done
} > "$OUT"

echo "wrote $OUT"
wc -l < "$OUT"
