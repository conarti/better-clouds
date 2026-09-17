#!/bin/sh
set -eu

SOURCE_ICON_PATH="design/icon.svg"
OUTPUT_DIRECTORY_PATH="public/icons"
ICON_SIZES="16 32 48 128"

mkdir -p "$OUTPUT_DIRECTORY_PATH"

for icon_size in $ICON_SIZES; do
  rsvg-convert -w "$icon_size" -h "$icon_size" "$SOURCE_ICON_PATH" -o "$OUTPUT_DIRECTORY_PATH/icon-$icon_size.png"
done
