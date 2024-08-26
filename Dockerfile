# syntax=docker/dockerfile-upstream:master-labs

# Base emsdk image with environment variables.
FROM emscripten/emsdk:3.1.40 AS emsdk-base
ARG EXTRA_CFLAGS
ARG EXTRA_LDFLAGS
ARG FFMPEG_ST
ARG FFMPEG_MT
ENV INSTALL_DIR=/opt
# We cannot upgrade to n6.0 as ffmpeg bin only supports multithread at the moment.
ENV FFMPEG_VERSION=n5.1.4
ENV CFLAGS="-I$INSTALL_DIR/include $CFLAGS $EXTRA_CFLAGS"
ENV CXXFLAGS="$CFLAGS"
ENV LDFLAGS="-L$INSTALL_DIR/lib $LDFLAGS $CFLAGS $EXTRA_LDFLAGS"
ENV EM_PKG_CONFIG_PATH=$EM_PKG_CONFIG_PATH:$INSTALL_DIR/lib/pkgconfig:/emsdk/upstream/emscripten/system/lib/pkgconfig
ENV EM_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
ENV PKG_CONFIG_PATH=$PKG_CONFIG_PATH:$EM_PKG_CONFIG_PATH
ENV FFMPEG_ST=$FFMPEG_ST
ENV FFMPEG_MT=$FFMPEG_MT
RUN apt-get update && \
      apt-get install -y pkg-config autoconf automake libtool ragel


# Base ffmpeg image with dependencies and source code populated.
FROM emsdk-base AS ffmpeg-base
ADD https://github.com/FFmpeg/FFmpeg.git#$FFMPEG_VERSION /src

# Build ffmpeg
FROM ffmpeg-base AS ffmpeg-builder
COPY build/ffmpeg.sh /src/build.sh
RUN bash -x /src/build.sh
      

# Build ffmpeg.wasm
FROM ffmpeg-builder AS ffmpeg-wasm-builder
COPY src/c /src/src/c
COPY src/js /src/src/js
COPY build/ffmpeg-wasm.sh build.sh
# libraries to link
RUN mkdir -p /src/dist/umd && bash -x /src/build.sh \
      -o dist/umd/ffmpeg-core.js
RUN mkdir -p /src/dist/esm && bash -x /src/build.sh \
      -sEXPORT_ES6 \
      -o dist/esm/ffmpeg-core.js

# Export ffmpeg-core.wasm to dist/, use `docker buildx build -o . .` to get assets
FROM scratch AS exportor
COPY --from=ffmpeg-wasm-builder /src/dist /dist
