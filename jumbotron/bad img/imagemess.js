// ======================================================================
// Image


var fs = require('fs');
var path = require('path');
var url = require('url');
var gm = require('gm');
var params = require('./params');
var utils = require('./utils');
var Queue = require('./queue');
var Base = require('./base');
var Viewport = require('./viewport');
var exec = require('child_process').exec;
// Constructor
function ffmpeg(callback){
    var self = this;
    //var cmd = "gm identify -ping -verbose " + self.source;
    var cmd2 = 'ffprobe -show_streams -show_files' + self.source;
    exec(cmd2, function(err, stdout, stderr) {
    var stringout = '' + stdout; // coerce into string for sure
    var pieces = stringout.replace(/=/g,"\n").split('\n'); //make an array 
	var data = ([parseInt(pieces[pieces.indexOf("width")+1]), parseInt(pieces[pieces.indexOf("height")+1]), pieces[pieces.indexOf("codec_name")+1].toLowerCase(), 200,
	parseInt(pieces[pieces.indexOf("size")+1].toLowerCase())]);
    return data;
});
}

function Image(options) {
    Base.call(this, options);

    // options can be a string, a list of options, or nothing
    options = options || {};

    // Parent pointer
    this.jumbotron = options.jumbotron;

    // URL
    this.source = utils.isString(options) ? options : options.source;

    // Size
    this.width = options.width || 0;
    this.height = options.height || 0;

    // Format (jpeg, ...)
    this.format = options.format || "";

    // Viewport that the jumbotron uses to display this image
    this.viewport = options.viewport
	? new Viewport(options.viewport)
	: new Viewport({ width: this.width, height: this.height });

    // On or off
    this.active = options.active || true;
}

// ----------------------------------------------------------------------
// Subclass and Members

Image.prototype = utils.inherits(Base, {
    
    // Serialize
    toJSON: function toJSON() {
	var ret = Base.prototype.toJSON.call(this);
	ret.source = this.source;
	ret.width = this.width;
	ret.height = this.height;
	ret.viewport = this.viewport;
	ret.active = this.active;
	return ret;
    },

    init: function init(cb) {

	// Try to identify the file
	var ffmpegimg = ffmpeg(this.source);
	    if (! (ffmpegimg[2] &&
		   ffmpegimg[2].toLowerCase() in params.allowedFileTypes))
		return cb && cb('bad image');

	    // Save format info
	    this.width = ffmpegimg[0];
	    this.height = ffmpegimg[1];
        this.format = ffmpegimg[2];
        var size = 
		    { width : ffmpegimg[0],
		      height: ffmpegimg[1] 
		    };
	    this.viewport = new Viewport(size);
	    // TODO? check if ext and format don't match

	   /* // Reorient if needed
	    if (data.exif) {
		var angle = {1:0, 3:180, 6:90, 8:270}[data.exif.orientation];
		if (angle) {
		    // Transpose width and height
		    if (angle != 180) {
			this.width = data.size.height;
			this.height = data.size.width;
		    }
		  //  return ffmpeg.rotate("black", angle).write(this.source, cb);
		}*/	    
	    cb && cb(err);
    },

    makeThumbnail: function makeThumbnail(size, cb) {
	Image.makeThumbnail(this.source, size, cb);
    }
});

// ----------------------------------------------------------------------
// Class Members
// For lack of a better place, these image getters are here.

var errorImage = null;

// Image shown when a display wasn't found during calibration.
// Cached since it can be shared.
Image.getErrorImage = function getErrorImage() {
    if (! errorImage)
	errorImage = new Image(params.errorImageOptions);
    return errorImage;
};

// Calibration image, shown when a jumbotron is first calibrated.
// Can't be cached since user might change viewport.
Image.getCalibratedImage = function getCalibratedImage() {
    return new Image(params.calibratedImageOptions);
};

// Sample images
Image.getSampleImageFiles = function getSampleImageFiles(cb) {
    fs.readdir(params.samplesDir, function(err, files) {
	if (err)
	    return cb(err);
	var legitExtensions =  {'.jpg':1, '.gif':1, '.png':1, 'mjpeg':1, 'theora':1 };
	var fullFiles = [];
	for (var f = 0; f < files.length; f++) {
	    if (path.extname(files[f]) in legitExtensions)
		fullFiles.push(path.join(params.samplesDir, files[f]));
	}
	cb(null, fullFiles);
    });
};
// TODO: fix this
Image._makeThumbnail = function _makeThumbnail(src, dst, width, height, cb) {
    var scale_x = width*0.1;
    var scale_y = height*0.1;
    var comm = 'ffmpeg -y -i '+ src + ' -ss 0 -vframes 1 -s ' + 150 + "x" + 150 + ' -an '+ dst;
    exec(comm, function(err, stdout, stderr) {
    });
};

Image.makeThumbnail = function makeThumbnail(fileName, size, cb) {
    var dirName = path.dirname(fileName);
    var thumbnailDirName = path.join(dirName, 'tn');
    var thumbnailFileName = path.join(thumbnailDirName, path.basename(fileName));

    path.exists(thumbnailFileName, function(exists) {
	if (exists)
	    return cb && cb(null, thumbnailFileName);
	fs.mkdir(thumbnailDirName, 0755, function(err) {
	    // Ignore directory-already-exists error
	    Image._makeThumbnail(fileName, thumbnailFileName, size, size, function(err) {
		cb && cb(err, thumbnailFileName);
	    });
	});
    });
};

// ----------------------------------------------------------------------
// Export

module.exports = Image;

// ----------------------------------------------------------------------

// gm identify ignores exif tags

