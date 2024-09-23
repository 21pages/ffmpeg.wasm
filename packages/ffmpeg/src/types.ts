/**
 * ffmpeg-core loading configuration.
 */
export interface FFMessageLoadConfig {
  /**
   * `ffmpeg-core.js` URL.
   *
   * @defaultValue `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`;
   */
  coreURL?: string;
  /**
   * `ffmpeg-core.wasm` URL.
   *
   * @defaultValue `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`;
   */
  wasmURL?: string;
  /**
   * `ffmpeg-core.worker.js` URL. This worker is spawned when using multithread version of ffmpeg-core.
   *
   * @ref: https://ffmpegwasm.netlify.app/docs/overview#architecture
   * @defaultValue `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd/ffmpeg-core.worker.js`;
   */
  workerURL?: string;
  /**
   * `ffmpeg.worker.js` URL. This worker is spawned when FFmpeg.load() is called, it is an essential worker and usually you don't need to update this config.
   *
   * @ref: https://ffmpegwasm.netlify.app/docs/overview#architecture
   * @defaultValue `./worker.js`
   */
  classWorkerURL?: string;
}

export interface FFMessageDecodePara {
  codec: number;
  data: Uint8Array;
}
export type FFMessageData =
  | FFMessageLoadConfig
   | FFMessageDecodePara
export interface Message {
  type: string;
  data?: FFMessageData;
}

export interface FFMessage extends Message {
  id: number;
}

export interface FFMessageEvent extends MessageEvent {
  data: FFMessage;
}

export type ExitCode = number;
export type ErrorMessage = string;
export type IsFirst = boolean;
export type OK = boolean;

export interface FSNode {
  name: string;
  isDir: boolean;
}

export type CallbackData = number | IsFirst |  object;

export interface Callbacks {
  [id: number | string]: (data: CallbackData) => void;
}

export interface FFMessageEventCallback {
  data: {
    id: number;
    type: string;
    data: CallbackData;
  };
}
