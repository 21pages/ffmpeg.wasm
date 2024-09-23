
export type FFMessageDecodeFrameBuffer = {
  data: Uint8Array;
  width: number;
  height: number;
  yuvFormat: number;
}

/**
 * FFmpeg core module, an object to interact with ffmpeg.
 */
export interface FFmpegCoreModule {
  mainScriptUrlOrBlob: string;
  frameBuffer: FFMessageDecodeFrameBuffer;

  decode: (codec: number, data: Uint8Array) => number;
}

/**
 * Factory of FFmpegCoreModule.
 */
export type FFmpegCoreModuleFactory = (
  moduleOverrides?: Partial<FFmpegCoreModule>
) => Promise<FFmpegCoreModule>;
