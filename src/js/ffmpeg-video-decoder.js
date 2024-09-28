/**
 * Constants
 */

/**
 * Variables
 */

Module['frameBuffer'] = null;
Module['recycledFrames'] = [];

/**
 * Functions
 */

function _processFrame(codec, data, callback) {
	// Map the ArrayBuffer into emscripten's runtime heap
	var len = data.byteLength;
	var buffer = Module['_malloc'](len);
	var dest = new Uint8Array(wasmMemory.buffer, buffer, len);
	dest.set(new Uint8Array(data));
	var ret = Module['_ffmpeg_decode'](codec, buffer, len);
	Module['_free'](buffer);
	callback(ret);
	return ret;
};

function _recycleFrame(frame) {
	var arr = Module['recycledFrames'];
	arr.push(frame);
	if (arr.length > 8) {
		arr.shift();
	}
};

function _close() {
	Module['_ffmpeg_destroy_decoder']();
}

/**
 * In multithread version of ffmpeg.wasm, the bootstrap process is like:
 * 1. Execute ffmpeg-core.js
 * 2. ffmpeg-core.js spawns workers by calling `new Worker("ffmpeg-core.worker.js")`
 * 3. ffmpeg-core.worker.js imports ffmpeg-core.js
 * 4. ffmpeg-core.js imports ffmpeg-core.wasm
 *
 * It is a straightforward process when all files are in the same location.
 * But when files are in different location (or Blob URL), #4 fails because
 * there is no way to pass custom ffmpeg-core.wasm URL to ffmpeg-core.worker.js
 * when it imports ffmpeg-core.js in #3.
 *
 * To fix this issue, a hack here is leveraging mainScriptUrlOrBlob variable by
 * adding wasmURL and workerURL in base64 format as query string. ex:
 *
 *   http://example.com/ffmpeg-core.js#{btoa(JSON.stringify({"wasmURL": "...", "workerURL": "..."}))}
 *
 * Thus, we can successfully extract custom URLs using _locateFile funciton.
 */
function _locateFile(path, prefix) {
	const mainScriptUrlOrBlob = Module["mainScriptUrlOrBlob"];
	if (mainScriptUrlOrBlob) {
		const { wasmURL, workerURL } = JSON.parse(
		atob(mainScriptUrlOrBlob.slice(mainScriptUrlOrBlob.lastIndexOf("#") + 1))
		);
		if (path.endsWith(".wasm")) return wasmURL;
		if (path.endsWith(".worker.js")) return workerURL;
	}
	return prefix + path;
}
	
Module["locateFile"] = _locateFile;
Module['processFrame'] = _processFrame;
Module['recycleFrame'] = _recycleFrame;
Module['close'] = _close;

