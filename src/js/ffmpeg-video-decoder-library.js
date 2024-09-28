/* global LibraryManager */
/* global mergeInto */
/* global Module */
/* global wasmMemory */

mergeInto(LibraryManager.library, {
	ffmpeg_decode_callback: function(data, width, height, yuvFormat) {
		var recycled = Module['recycledFrames'];
		var array = null;
		const len = width * height * 8;
		while(recycled.length > 0) {
			var frame = recycled.pop();
			if (frame.length === len) {
				array = frame;
				break;
			}
		}
		if (!array) {
			array = new Uint8Array(len);
			console.log('Allocated new frame buffer in decode callback');
		}
		array.set(new Uint8Array(wasmMemory.buffer, data, len));
		Module['frameBuffer'] = { data: array, width: width, height: height, yuvFormat: yuvFormat };
	},
});
