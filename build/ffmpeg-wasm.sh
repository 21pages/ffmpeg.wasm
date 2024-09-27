#!/bin/bash
# `-o <OUTPUT_FILE_NAME>` must be provided when using this build script.
# ex:
#     bash ffmpeg-wasm.sh -o ffmpeg.js

set -euo pipefail

EXPORT_NAME="createFFmpegCore"

CONF_FLAGS=(
  -I. 
  -I./src/c 
  -I$INSTALL_DIR/include 
  -L$INSTALL_DIR/lib 
  -Llibavcodec 
  -Llibavutil 
  -Llibswscale
  -lavcodec 
  -lavutil
  -lswscale
  -Wno-deprecated-declarations 
  $LDFLAGS 
  -sWASM_BIGINT                            # enable big int support
  #-sMODULARIZE                             # modularized to use as a library
  -sNO_FILESYSTEM
  ${FFMPEG_MT:+ -sINITIAL_MEMORY=1024MB}   # ALLOW_MEMORY_GROWTH is not recommended when using threads, thus we use a large initial memory
  ${FFMPEG_MT:+ -sPTHREAD_POOL_SIZE=32}    # use 32 threads
  ${FFMPEG_ST:+ -sINITIAL_MEMORY=32MB -sALLOW_MEMORY_GROWTH} # Use just enough memory as memory usage can grow
  -sEXPORT_NAME="$EXPORT_NAME"             # required in browser env, so that user can access this module from window object
  -sEXPORTED_FUNCTIONS="`< src/js/ffmpeg-video-decoder-exports.json`" # exported functions
  #-sEXPORTED_RUNTIME_METHODS=$(node src/bind/ffmpeg/export-runtime.js) # exported built-in functions
  --js-library src/js/ffmpeg-video-decoder-library.js \
  --pre-js src/js/ffmpeg-video-decoder.js \
  # ffmpeg source code
  src/c/ffmpeg-video-decoder.c
)

emcc "${CONF_FLAGS[@]}" $@
