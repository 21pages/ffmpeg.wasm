/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import type { FFmpegCoreModule, FFmpegCoreModuleFactory } from "@ffmpeg/types";
import type {
  FFMessageLoadConfig,
  FFMessageDecodePara,
  IsFirst,
  FFMessageEvent,
} from "./types";
import { CORE_URL } from "./const.js";
import {
  ERROR_NOT_LOADED,
  ERROR_IMPORT_FAILURE,
} from "./errors.js";

declare global {
  interface WorkerGlobalScope {
    createFFmpegCore: FFmpegCoreModuleFactory;
  }
}

interface ImportedFFmpegCoreModuleFactory {
  default: FFmpegCoreModuleFactory;
}

let ffmpeg: FFmpegCoreModule;

const load = async ({
  coreURL: _coreURL,
  wasmURL: _wasmURL,
  workerURL: _workerURL,
}: FFMessageLoadConfig): Promise<IsFirst> => {
  const first = !ffmpeg;

  try {
    if (!_coreURL) _coreURL = CORE_URL;
    // when web worker type is `classic`.
    importScripts(_coreURL);
  } catch {
    if (!_coreURL || _coreURL === CORE_URL) _coreURL = CORE_URL;
    // when web worker type is `module`.
    (self as WorkerGlobalScope).createFFmpegCore = (
      (await import(
        /* @vite-ignore */ _coreURL
      )) as ImportedFFmpegCoreModuleFactory
    ).default;

    if (!(self as WorkerGlobalScope).createFFmpegCore) {
      throw ERROR_IMPORT_FAILURE;
    }
  }

  const coreURL = _coreURL;
  const wasmURL = _wasmURL ? _wasmURL : _coreURL.replace(/.js$/g, ".wasm");
  const workerURL = _workerURL
    ? _workerURL
    : _coreURL.replace(/.js$/g, ".worker.js");

  ffmpeg = await (self as WorkerGlobalScope).createFFmpegCore({
    // Fix `Overload resolution failed.` when using multi-threaded ffmpeg-core.
    // Encoded wasmURL and workerURL in the URL as a hack to fix locateFile issue.
    mainScriptUrlOrBlob: `${coreURL}#${btoa(
      JSON.stringify({ wasmURL, workerURL })
    )}`,
  });
  return first;
};

const decode = ({ codec, data }: FFMessageDecodePara): number => {
   // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
   return ffmpeg.decode(codec, data);
};

self.onmessage = async ({
  data: { id, type, data: _data },
}: FFMessageEvent): Promise<void> => {
  try {
    if (type !== "LOAD" && !ffmpeg) throw ERROR_NOT_LOADED; // eslint-disable-line
    switch (type) {
      case "LOAD":
        {
          const ret = await load(_data as FFMessageLoadConfig);
          self.postMessage({ id, type, data: ret }, []);
        }
        
        break;
      case "DECODE":
        {
          const ret = decode(_data as FFMessageDecodePara);
          if (ret === -1) {
            self.postMessage({
              id,
              type,
              data: ret,
            });
            return;
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            self.postMessage({ id, type, data: ffmpeg.frameBuffer }, [ffmpeg.frameBuffer.data]);
          }
          }
          break;
        }
  } catch (e) {
    self.postMessage({
      id,
      type: "ERROR",
      data: (e as Error).toString(),
    });
    return;
  }
};
