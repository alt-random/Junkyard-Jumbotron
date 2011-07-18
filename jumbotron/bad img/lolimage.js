// ======================================================================
// Image

var fs = require('fs');
var path = require('path');
var url = require('url');
var gm = require('gm');
var exec = require('child_process').exec;
var params = require('./params');
var utils = require('./utils');
var Queue = require('./queue');
var Base = require('./base');
var Viewport = require('./viewport');
// FFMPEG FUNCTION::::::::::::::::::::::::::::::::::::::::: TODO: Make it into a npm package.
// thumb makes thumbnails
//ping retrieves informations
//general is a filler, it returns info in a useless form.
var ffmpeg = function(type, input, output){
    var prefix = '',
    suffix = '';
    switch(type){
    case 'thumb':
        prefix = 'ffmpeg -y -i';
        suffix = '-ss 0 -vframes 1 -s 150x150 -an';
        output = output.slice(0,output.lastIndexOf('.'))+'.jpg';
        break;
    case 'ping':
        prefix = 'ffprobe -show_streams -show_files';
        break;
    case 'general':
        prefix = 'ffprobe';
        break;
    case 'convert':
    }
    var command = prefix+' '+input+' '+suffix+' '+output;
    return exec(command, function(err, stdout, stderr) {
       
        return [err, stdout, stderr];
    });
}
//::::::::::::::::::::::::::::::::::::::::::::::::::::::::

// Constructor
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
	var gmImg = gm(this.source);
	gmImg.identify(function(err, data) {
	    if (err) {
		if (err.code == 1)
		    err = 'bad image';
		return cb && cb(err);
	    }
	    if (! (data.format &&
		   data.format in params.allowedFileTypes))
		return cb && cb('bad image');

	    // Save format info
	    this.format = data.format;
	    this.width = data.size.width;
	    this.height = data.size.height;
	    this.viewport = new Viewport(data.size);
	    // TODO? check if ext and format don't match

	    // Reorient if needed TODO: This is important. TODO:
	  /*  if (data.exif) {
		var angle = {1:0, 3:180, 6:90, 8:270}[data.exif.orientation];
		if (angle) {
		    // Transpose width and height
		    if (angle != 180) {
			this.width = data.size.height;
			this.height = data.size.width;
		    }
		    return gmImg.rotate("black", angle).write(this.source, cb);
		}
	    }*/
	    cb && cb(err);
	}.bind(this));
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
	var legitExtensions =  {'.jpg':1, '.gif':1, '.png':1, '.ogv':1 };
	var fullFiles = [];
	for (var f = 0; f < files.length; f++) {
	    if (path.extname(files[f]) in legitExtensions)
		fullFiles.push(path.join(params.samplesDir, files[f]));
	}
	cb(null, fullFiles);
    });
};

Image._makeThumbnail = function _makeThumbnail(src, dst, width, height, cb) {
    ffmpeg('thumb', src, dst);
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
gm.prototype.identify = function(callback){
    var self = this;
    if (!callback)
	return self;
    if (self._identifying) {
	self._iq.push(callback);
	return self;
    }
    if (Object.keys(self.data).length)  {
	callback.call(self, null, self.data);
	return self;
    }
    self._iq = [callback];
    self._identifying = true;
    var video_types = ['.ogv', '.ogg'];
    var get = ffmpeg('ping', self.source, '');
    var stringout = '' + get[1]; // coerce into string for sure
    var pieces = stringout.replace(/=/g,"\n").split('\n'); //make an array 
	var data = self.data;
		data.size = { width: 0.0000001*parseInt(pieces[pieces.indexOf("width")+1]), height: 0.0000001*parseInt(pieces[pieces.indexOf("height")+1]) };
		data.format = self.source.slice(self.source.lastIndexOf('.')).toLowerCase();
		data.filesize = parseInt(pieces[pieces.indexOf("size")+1]);
        var err = get[0];

    //if(data.format in video_types)
        
	var idx = self._iq.length;
	while (idx--)
	    self._iq[idx].call(self, null, self.data);
	self._identifying = false;
    return self;
};

