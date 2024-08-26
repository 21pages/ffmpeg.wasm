/* global LibraryManager */
/* global mergeInto */
/* global Module */
/* global wasmMemory */

mergeInto(LibraryManager.library, {
	ffmpeg_decode_callback: function(data, width, height) {
		Module['frameBuffer'] = { data: new Uint8Array(wasmMemory.buffer, data, width * height * 4), width: width, height: height };
	},
});
