#include <assert.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
//
#include <libavcodec/avcodec.h>
#include <libavutil/log.h>
#include <libavutil/opt.h>
#include <libavutil/pixdesc.h>
#include <libswscale/swscale.h>

#ifdef __EMSCRIPTEN_PTHREADS__
#include <emscripten/emscripten.h>
#include <emscripten/threading.h>
#include <pthread.h>
#endif

extern void ffmpeg_decode_callback(uint8_t *data, int width, int height);

enum CodecIndex {
  VP8 = 0,
  VP9,
  AV1,
  H264,
  HEVC,
  NUM_CODECS,
};

typedef struct FFmpegDecoder {
  AVCodecContext *c_;
  struct SwsContext *sws_;
  int last_sws_width_; 
  int last_sws_height_;
  AVPacket *pkt_;
  AVFrame *yuv_frame_;
  AVFrame *bgra_frame_;
  int codec_;
} FFmpegDecoder;

static FFmpegDecoder *d = NULL;

static void free_decoder_fields(FFmpegDecoder *d) {
  if (d->yuv_frame_) av_frame_free(&d->yuv_frame_);
  if (d->bgra_frame_) av_frame_free(&d->bgra_frame_);
  if (d->pkt_) av_packet_free(&d->pkt_);
  if (d->c_) avcodec_free_context(&d->c_);
  if (d->sws_) sws_freeContext(d->sws_);

  d->yuv_frame_ = NULL;
  d->bgra_frame_ = NULL;
  d->pkt_ = NULL;
  d->c_ = NULL;
  d->sws_ = NULL;
  d->last_sws_width_ = 0;
  d->last_sws_height_ = 0;
}

static int get_thread_count() {
#ifdef __EMSCRIPTEN_PTHREADS__
  const int max_cores = 8;  // max threads for UHD tiled decoding
  int cores = emscripten_num_logical_cores();
  if (cores == 0) {
    // Safari 15 does not report navigator.hardwareConcurrency...
    // Assume at least two fast cores are available.
    cores = 2;
  } else if (cores > max_cores) {
    cores = max_cores;
  }
  return cores;
#else
  return 1;
#endif
}

static int reset(FFmpegDecoder *d) {
  free_decoder_fields(d);
  const AVCodec *codec = NULL;
  int ret;
  const char *name = NULL;
  switch (d->codec_) {
    case VP8:
      name = "vp8";
      break;
    case VP9:
      name = "vp9";
      break;
    case AV1:
      name = "libaom-av1";
      break;
    case H264:
      name = "h264";
      break;
    case HEVC:
      name = "hevc";
      break;
    default:
      printf("unknown codec\n");
      return -1;
  }
  if (!(codec = avcodec_find_decoder_by_name(name))) {
    printf("avcodec_find_decoder_by_name failed\n");
    return -1;
  }
  if (!(d->c_ = avcodec_alloc_context3(codec))) {
    printf("Could not allocate video codec context\n");
    return -1;
  }

  d->c_->flags |= AV_CODEC_FLAG_LOW_DELAY;
  d->c_->thread_count = get_thread_count();
  d->c_->thread_type = FF_THREAD_SLICE;

  if (!(d->pkt_ = av_packet_alloc())) {
    printf("av_packet_alloc failed\n");
    return -1;
  }

  if (!(d->yuv_frame_ = av_frame_alloc())) {
    printf("av_frame_alloc failed\n");
    return -1;
  }

  if ((ret = avcodec_open2(d->c_, codec, NULL)) != 0) {
    printf("avcodec_open2 failed\n");
    return -1;
  }

  return 0;
}

void ffmpeg_destroy_decoder(void) {
  free_decoder_fields(d);
  free(d);
  d = NULL;
}

static int do_decode(const uint8_t *data, int length) {
  int ret = -1;
  bool decoded = false;

  if (!data || !length) {
    printf("illegal decode parameter\n");
    return -1;
  }
  // fill data
  d->pkt_->data = (uint8_t *)data;
  d->pkt_->size = length;

  // decode
  ret = avcodec_send_packet(d->c_, d->pkt_);
  if (ret < 0) {
    printf("avcodec_send_packet failed\n");
    return ret;
  }

  while (ret >= 0) {
    if ((ret = avcodec_receive_frame(d->c_, d->yuv_frame_)) != 0) {
      if (ret != AVERROR(EAGAIN)) {
        printf("avcodec_receive_frame failed\n");
      }
      goto _exit;
    }
    decoded = true;
    break;
  }
_exit:
  av_packet_unref(d->pkt_);
  return decoded ? 0 : -1;
}

static int prepare_convert() {
  int ret = 0;
  int width = d->yuv_frame_->width;
  int height = d->yuv_frame_->height;
  if (d->sws_) {
    if (d->last_sws_width_ != width || d->last_sws_height_ != height) {
      printf("free swsContext, size changed, w: %d->%d, h: %d->%d\n", d->last_sws_width_ , width,
             d->last_sws_height_, height);
      sws_freeContext(d->sws_);
      d->sws_ = NULL;
      d->last_sws_width_ = 0;
      d->last_sws_height_ = 0;
    }
  }
  if (!d->sws_) {
    printf("sws_getContext, format:%d, width:%d, height:%d\n",
           d->yuv_frame_->format, d->yuv_frame_->width, d->yuv_frame_->height);
    d->sws_ =
        sws_getContext(width, height, d->yuv_frame_->format, width, height,
                       AV_PIX_FMT_RGBA, SWS_BILINEAR, NULL, NULL, NULL);
    if (!d->sws_) {
      printf("sws_getContext failed\n");
      return -1;
    }
    d->last_sws_width_ = width;
    d->last_sws_height_ = height;
  }
  if (d->bgra_frame_) {
    if (d->bgra_frame_->width != width || d->bgra_frame_->height != height) {
      printf("free bgra_frame, size changed, w: %d->%d, h: %d->%d\n",
             d->bgra_frame_->width, width, d->bgra_frame_->height, height);
      av_frame_free(&d->bgra_frame_);
      d->bgra_frame_ = NULL;
    }
  }
  if (!d->bgra_frame_) {
    d->bgra_frame_ = av_frame_alloc();
    if (!d->bgra_frame_) {
      printf("av_frame_alloc failed\n");
      return -1;
    }
    d->bgra_frame_->format = AV_PIX_FMT_RGBA;
    d->bgra_frame_->width = width;
    d->bgra_frame_->height = height;
    if ((ret = av_frame_get_buffer(d->bgra_frame_, 1)) < 0) {
      printf("av_frame_get_buffer failed, err=%s\n", av_err2str(ret));
      av_frame_free(&d->bgra_frame_);
      return -1;
    }
  }

  return 0;
}

int ffmpeg_decode(const int codec, const uint8_t *data, const int length) {
  int ret = 0;

  if (!d) {
    printf("init decoder %d\n", codec);
    d = malloc(sizeof(FFmpegDecoder));
    if (!d) {
      return -1;
    }
    memset(d, 0, sizeof(FFmpegDecoder));
    d->codec_ = codec;
    if (reset(d) != 0) {
      free_decoder_fields(d);
      free(d);
      d = NULL;
      return -1;
    }
  }
  if (d->codec_ != codec) {
    d->codec_ = codec;
    printf("codec changed, %d -> %d\n", d->codec_, codec);
    if (reset(d) != 0) {
      return -1;
    }
  }
  if (do_decode(data, length) != 0) {
    printf("do_decode failed\n");
    return -1;
  }
  if (prepare_convert() != 0) {
    printf("prepare_convert failed\n");
    return -1;
  }
  ret = sws_scale(d->sws_, d->yuv_frame_->data, d->yuv_frame_->linesize, 0,
                  d->yuv_frame_->height, d->bgra_frame_->data,
                  d->bgra_frame_->linesize);
  if (ret < 0) {
    printf("sws_scale failed, err=%s\n", av_err2str(ret));
    return -1;
  }
  ffmpeg_decode_callback(d->bgra_frame_->data[0], d->bgra_frame_->width,
                         d->bgra_frame_->height);
  return 0;
}
