/* global Module */
/* global options */
/* global ArrayBuffer */
/* global wasmMemory */

// - Properties

/**
 * Last-decoded video packet
 * @property object
 */
Module['frameBuffer'] = null;

// - public methods

/**
 * Decode the given video data packet; fills out the frameBuffer property on success
 * 
 * @param codec int codec index
 * @param ArrayBuffer data
 * @param function callback on completion
 */
Module['processFrame'] = function(codec, data, callback) {

	// Map the ArrayBuffer into emscripten's runtime heap
	var len = data.byteLength;
	var buffer = Module['_malloc'](len);
	var dest = new Uint8Array(wasmMemory.buffer, buffer, len);
	dest.set(new Uint8Array(data));
	var ret = Module['_ffmpeg_decode'](codec, buffer, len);
	Module['_free'](buffer);
	callback(ret);
};

/**
 * Close out any resources required by the decoder module
 */
Module['close'] = function() {
	Module['_ffmpeg_destroy_decoder']();
};

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