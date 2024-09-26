all: dev

MT_FLAGS := -sUSE_PTHREADS -pthread

DEV_ARGS := --progress=plain

DEV_CFLAGS := --profiling
DEV_MT_CFLAGS := $(DEV_CFLAGS) $(MT_FLAGS)
PROD_CFLAGS := -O3 -msimd128
PROD_CFLAGS_NO_SIMD := -O3
PROD_MT_CFLAGS := $(PROD_CFLAGS) $(MT_FLAGS)

clean:
	rm -rf ./packages/core$(PKG_SUFFIX)/dist

.PHONY: build
build:
	make clean PKG_SUFFIX="$(PKG_SUFFIX)"
	EXTRA_CFLAGS="$(EXTRA_CFLAGS)" \
	EXTRA_LDFLAGS="$(EXTRA_LDFLAGS)" \
	FFMPEG_ST="$(FFMPEG_ST)" \
	FFMPEG_MT="$(FFMPEG_MT)" \
		docker buildx build \
			--build-arg EXTRA_CFLAGS \
			--build-arg EXTRA_LDFLAGS \
			--build-arg FFMPEG_MT \
			--build-arg FFMPEG_ST \
			-o ./packages/core$(PKG_SUFFIX) \
			$(EXTRA_ARGS) \
			.

build-st:
	make build \
		FFMPEG_ST=yes

build-st-no-simd:
	make build \
		PKG_SUFFIX=-no-simd \
		FFMPEG_ST=yes

build-mt:
	make build \
		PKG_SUFFIX=-mt \
		FFMPEG_MT=yes

dev:
	make build-st EXTRA_CFLAGS="$(DEV_CFLAGS)" EXTRA_ARGS="$(DEV_ARGS)"

dev-mt:
	make build-mt EXTRA_CFLAGS="$(DEV_MT_CFLAGS)" EXTRA_ARGS="$(DEV_ARGS)"

prd:
	make build-st EXTRA_CFLAGS="$(PROD_CFLAGS)"

prd-no-simd:
	make build-st-no-simd EXTRA_CFLAGS="$(PROD_CFLAGS_NO_SIMD)"

prd-mt:
	make build-mt EXTRA_CFLAGS="$(PROD_MT_CFLAGS)"
