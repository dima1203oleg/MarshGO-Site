#!/usr/bin/env bash
# Reproducible design-debt metrics for the MARSHGO Premium Design 3.0 audit.
# Run from the root of a MarshGO-Site checkout pinned to the audited SHA.
#   ./docs/design/research/premium-3.0/evidence/measure-debt.sh
# Every number printed by DESIGN_AUDIT_3.0.md comes from this script, so the
# owner can re-derive it without trusting a transcription.
set -uo pipefail

REV="${1:-HEAD}"
SRC="src"

# File list comes from git, not the filesystem, so untracked scratch files
# never inflate a count.
list() { # list <glob-ish extension...>
  git ls-tree -r --name-only "$REV" -- "$SRC" | while read -r f; do
    for ext in "$@"; do
      case "$f" in *."$ext") printf '%s\n' "$f"; break ;; esac
    done
  done
}

# `git show` per file + grep -o = occurrences, not matching lines.
occurrences() { # occurrences <pattern> <extension...>
  local pattern="$1"; shift
  local total=0 n
  while read -r f; do
    [ -z "$f" ] && continue
    n=$(git show "${REV}:${f}" 2>/dev/null | grep -oE "$pattern" 2>/dev/null | wc -l | tr -d ' ')
    total=$((total + n))
  done < <(list "$@")
  printf '%s' "$total"
}

loc() { # loc <path>
  git show "${REV}:${1}" 2>/dev/null | wc -l | tr -d ' '
}

# A colour literal is exactly #rgb, #rgba, #rrggbb or #rrggbbaa. Matching the
# bare hex run and filtering by length keeps a 7-digit or truncated token from
# being counted as a colour.
hexcount() { # hexcount <extension...>
  local total=0 n
  while read -r f; do
    [ -z "$f" ] && continue
    n=$(git show "${REV}:${f}" 2>/dev/null \
        | grep -oE '#[0-9a-fA-F]+\b' \
        | awk 'length($0)==4 || length($0)==5 || length($0)==7 || length($0)==9 {c++} END {print c+0}')
    total=$((total + n))
  done < <(list "$@")
  printf '%s' "$total"
}

echo "# measure-debt.sh"
echo "# rev: $(git rev-parse "$REV")"
echo "# date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

echo "## Sizes"
for f in "$SRC/index.css" \
         "$SRC/views/ProductionMarketplace.tsx" \
         "$SRC/views/ProductionNavigation.tsx" \
         "$SRC/views/JourneyResultsPanel.tsx" \
         "$SRC/map/MapLibreAdapter.ts"; do
  printf '  %-46s %s LOC\n' "$f" "$(loc "$f")"
done
printf '  %-46s %s\n' "source files (ts/tsx/css/html under src)" \
  "$(list ts tsx css html | wc -l | tr -d ' ')"
echo

echo "## Raw colour literals (#rgb, #rgba, #rrggbb, #rrggbbaa)"
printf '  %-46s %s\n' "in .css"  "$(hexcount css)"
printf '  %-46s %s\n' "in .ts/.tsx" "$(hexcount ts tsx)"
echo "  note: exact-length match; a 7-digit or truncated hex run is not counted."
echo

echo "## Sub-token font sizes (arbitrary Tailwind text-[Npx])"
sizes=$(while read -r f; do
  [ -z "$f" ] && continue
  git show "${REV}:${f}" 2>/dev/null | grep -oE 'text-\[[0-9]+px\]'
done < <(list ts tsx) | sort | uniq -c | sort -rn)
echo "$sizes" | sed 's/^/  /'
echo "  total text-[Npx] occurrences: $(echo "$sizes" | awk '{s+=$1} END {print s+0}')"
echo "  occurrences below 12px:       $(echo "$sizes" | awk '$2 ~ /\[1[01]px\]|\[[1-9]px\]/ {s+=$1} END {print s+0}')"
echo

echo "## Touch-target floor"
printf '  %-46s %s\n' "min-h-11 (44px) occurrences" "$(occurrences 'min-h-11' ts tsx)"
printf '  %-46s %s\n' "h-7 / w-7 (28px) control classes" "$(occurrences '\bh-[0-9]\b' ts tsx)"
echo

echo "## Design-token surface"
printf '  %-46s %s\n' "custom properties declared in index.css" "$(git show "${REV}:$SRC/index.css" 2>/dev/null | grep -coE '^\s*--[a-zA-Z0-9-]+:' )"
printf '  %-46s %s\n' "--mg-* declarations" "$(git show "${REV}:$SRC/index.css" 2>/dev/null | grep -coE '^\s*--mg-[a-zA-Z0-9-]+:')"
printf '  %-46s %s\n' "--mode-* declarations" "$(git show "${REV}:$SRC/index.css" 2>/dev/null | grep -coE '^\s*--mode-[a-zA-Z0-9-]+:')"
printf '  %-46s %s\n' "--route-* declarations" "$(git show "${REV}:$SRC/index.css" 2>/dev/null | grep -coE '^\s*--route-[a-zA-Z0-9-]+:')"
