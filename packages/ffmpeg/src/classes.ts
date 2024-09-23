import {
  CallbackData,
  Callbacks,
  FFMessageEventCallback,
  FFMessageLoadConfig,
  IsFirst,
  Message,
} from "./types.js";
import { getMessageID } from "./utils.js";
import { ERROR_NOT_LOADED } from "./errors.js";

type FFMessageOptions = {
  signal?: AbortSignal;
};

/**
 * Provides APIs to interact with ffmpeg web worker.
 *
 * @example
 * ```ts
 * const ffmpeg = new FFmpeg();
 * ```
 */
export class FFmpeg {
  #worker: Worker | null = null;
  /**
   * #resolves and #rejects tracks Promise resolves and rejects to
   * be called when we receive message from web worker.
   */
  #resolves: Callbacks = {};
  #rejects: Callbacks = {};

  public loaded = false;

  /**
   * register worker message event handlers.
   */
  #registerHandlers = () => {
    if (this.#worker) {
      this.#worker.onmessage = ({
        data: { id, type, data },
      }: FFMessageEventCallback) => {
        switch (type) {
          case "LOAD":
            this.loaded = true;
            this.#resolves[id](data);
            break;
          case "DECODE":
            this.#resolves[id](data);
            break;
        }
        delete this.#resolves[id];
        delete this.#rejects[id];
      };
    }
  };

  /**
   * Generic function to send messages to web worker.
   */
  #send = (
    { type, data }: Message,
    trans: Transferable[] = [],
    signal?: AbortSignal
  ): Promise<CallbackData> => {
    if (!this.#worker) {
      return Promise.reject(ERROR_NOT_LOADED);
    }

    return new Promise((resolve, reject) => {
      const id = getMessageID();
      this.#worker && this.#worker.postMessage({ id, type, data }, trans);
      this.#resolves[id] = resolve;
      this.#rejects[id] = reject;

      signal?.addEventListener(
        "abort",
        () => {
          reject(new DOMException(`Message # ${id} was aborted`, "AbortError"));
        },
        { once: true }
      );
    });
  };

  /**
   * Loads ffmpeg-core inside web worker. It is required to call this method first
   * as it initializes WebAssembly and other essential variables.
   *
   * @category FFmpeg
   * @returns `true` if ffmpeg core is loaded for the first time.
   */
  public load = (
    { classWorkerURL, ...config }: FFMessageLoadConfig = {},
    { signal }: FFMessageOptions = {}
  ): Promise<IsFirst> => {
    if (!this.#worker) {
      this.#worker = classWorkerURL ?
        new Worker(new URL(classWorkerURL, import.meta.url), {
          type: "module",
        }) :
        // We need to duplicated the code here to enable webpack
        // to bundle worekr.js here.
        new Worker(new URL("./worker.js", import.meta.url), {
          type: "module",
        });
      this.#registerHandlers();
    }
    return this.#send(
      {
        type: "LOAD",
        data: config,
      },
      undefined,
      signal
    ) as Promise<IsFirst>;
  };

    public decode = (
      codec: number,
      data: Uint8Array,
      { signal }: FFMessageOptions = {}
    ): Promise<number> =>
      this.#send(
        {
          type: "DECODE",
          data: { codec, data },
        },
        undefined,
        signal
      ) as Promise<number>;
}
