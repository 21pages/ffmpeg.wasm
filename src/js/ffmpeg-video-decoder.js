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




