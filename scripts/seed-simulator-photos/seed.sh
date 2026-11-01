#!/usr/bin/env bash
# Seeds an iOS Simulator photo library with a test set: ~320 real photos
# (picsum.photos) dated across the last 3 years, plus near-duplicate bursts,
# blurry retakes, and "On This Day" photos dated today in earlier years.
#
# Usage: scripts/seed-simulator-photos/seed.sh [count] [device]
#   count   number of base photos (default 320; total is ~1.35x that)
#   device  simulator name or UDID (default: booted)
#
# Downloads are cached in ~/Library/Caches/swipe-photos/seed-photos, so reruns
# are fast. Running it again ADDS photos; erase the simulator
# (Device > Erase All Content and Settings) for a clean library.
set -euo pipefail

COUNT="${1:-320}"
DEVICE="${2:-booted}"
DIR="$(cd "$(dirname "$0")" && pwd)"
CACHE="$HOME/Library/Caches/swipe-photos/seed-photos"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

# CocoaPods/Ruby and Swift tooling misbehave without a UTF-8 locale
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

mkdir -p "$CACHE"
echo "› Downloading $COUNT photos (cached in $CACHE)…"
export CACHE
seq -f %03g 1 "$COUNT" | xargs -P 10 -n 1 sh -c '
  i="$1"; f="$CACHE/p$i.jpg"
  # every 3rd photo landscape, the rest portrait
  if [ $(( 1$i % 3 )) -eq 0 ]; then size=1600/1200; else size=1200/1600; fi
  for _ in 1 2 3 4 5; do
    [ -s "$f" ] && break
    curl -sfL -m 30 -o "$f" "https://picsum.photos/seed/swipe$i/$size" || rm -f "$f"
  done
  [ -s "$f" ] || echo "  ! failed to download p$i.jpg"
' _

# Only feed the first $COUNT cached photos to the generator
SRC="$OUT/src"; mkdir -p "$SRC"
for i in $(seq -f %03g 1 "$COUNT"); do
  [ -s "$CACHE/p$i.jpg" ] && ln -s "$CACHE/p$i.jpg" "$SRC/p$i.jpg"
done

echo "› Generating dated photos, bursts, and blurry variants…"
swift "$DIR/generate.swift" "$SRC" "$OUT/photos"

echo "› Importing into simulator ($DEVICE)…"
(cd "$OUT/photos" && ls *.jpg | xargs -n 50 xcrun simctl addmedia "$DEVICE")
echo "✓ Done"
