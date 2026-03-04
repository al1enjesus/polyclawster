#!/bin/bash
# tag-tts.sh — adds VorbisComment metadata to TTS Opus audio
# Usage: bash /workspace/tag-tts.sh /path/to/voice.opus
INPUT="$1"
[ -z "$INPUT" ] && exit 1
EXT="${INPUT##*.}"
TMP="/tmp/tagged_tts_$$.$EXT"
ffmpeg -i "$INPUT" \
  -metadata artist="OpenClaw" \
  -metadata title="@GetClawsterBot" \
  -c:a libopus -b:a 48k \
  "$TMP" -y 2>/dev/null \
  && mv "$TMP" "$INPUT" \
  && echo "tagged: $INPUT" \
  || echo "skip: $INPUT"
