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
var execfunc = require('child_process').exec;



            function compatibility(fullsrc){
                var src = fullsrc.slice(fullsrc.lastIndexOf('public/'));
                var ext = src.slice(src.lastIndexOf('.'));
                var dst = src.slice(0, src.lastIndexOf('.'));
                switch(ext){
                case '.mp4':
                execfunc('ffmpeg2theora --videobitrate 200 --max_size 320x240 --output '+dst+'.ogv '+src, function(err, stdout, stderr){
                console.log(stdout);
                console.log(err);
                });
                break;
                case '.ogv':
                execfunc('HandBrakeCLI --preset "iPad" --vb 200 --two-pass --turbo --width 320 --turbo --optimize --input '+src+' --output '+dst+'.mp4', function(err, stdout, stderr){
                console.log(stdout);
                console.log(err);
                console.log(stderr);
                });
                break;
                }
            }


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
		   data.format.toLowerCase() in params.allowedFileTypes))
		return cb && cb('bad image');

	    // Save format info
	    this.format = data.format;
	    this.width = data.size.width;
	    this.height = data.size.height;
	    this.viewport = new Viewport(data.size);
	    // TODO? check if ext and format don't match

	    // Reorient if needed
	    if (data.exif) {
		var angle = {1:0, 3:180, 6:90, 8:270}[data.exif.orientation];
		if (angle) {
		    // Transpose width and height
		    if (angle != 180) {
			this.width = data.size.height;
			this.height = data.size.width;
		    }
		    return gmImg.rotate("black", angle).write(this.source, cb);
		}
	    }
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
	var legitExtensions =  {'.jpg':1, '.gif':1, '.png':1, '.ogv':1, '.mp4':1, '.mpeg':1 };
	var fullFiles = [];
	for (var f = 0; f < files.length; f++) {
	    if (path.extname(files[f]) in legitExtensions)
		fullFiles.push(path.join(params.samplesDir, files[f]));
	}
	cb(null, fullFiles);
    });
};

Image._makeThumbnail = function _makeThumbnail(src, dst, width, height, cb) {
    /*var loc = dst.slice(0, dst.lastIndexOf('.'))+'.jpg';
    var comm = "/opt/local/bin/ffmpeg -i "+src+" -f mjpeg -ss 0 -s "+width+"x"+height+" -vframes 1 -an "+loc;
    execfunc(comm, function(err, stdout, stderr){
    if(err)    
        console.log(err);
    });

                compatibility(src);
    */
    gm(src)
    .gravity('Center')
    // gm 1.3.5 doesn't support ^ postfix for resize
//.resize(width, height + '^')
    .resize(width, height)
    .crop(width, height, 0, 0)
    .noProfile()
    .write(dst, cb);
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


// gm doesn't escape file names properly
gm.prototype.cmd = function(){
    var src = utils.escapeForShell(this.source);
    var dst = this.outname ? utils.escapeForShell(this.outname) : src;
    var fullCmd =  ["gm convert" ,
	    this._in.join(" "),
            src,
            this._out.join(" "),
            dst].join(" ");
    //console.log(fullCmd);
    return fullCmd;
};

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
    // ffmpeg -i "+self.source+" -f mjpeg -ss 0 -vframes 1 -an - 2>/dev/null |
    var cmd = "identify -ping -verbose " + self.source;
    self._exec(cmd.split(' '), function(err, stdout, stderr) {
	if (err)
	    return callback.call(self, err, stdout, stderr, cmd);
	stdout = (stdout||"").trim().replace(/\r\n|\r/g, "\n");
	var parts = stdout.split("\n")
	, rgx = /^( *)([-a-zA-Z0-9 ]*): *(.*)/
	, data = self.data
	, cur
	, handle = {
	    'geometry': function(val) {
		var split = val.split("x");
		data.size = 
		    { width : parseInt(split[0], 10),
		      height: parseInt(split[1], 10) 
		    };
            },
            'format': function(val) {
		data.format = path.extname(self.source);
            },
            'depth': function(val) {
		data.depth = parseInt(val, 10);
            },
            'colors': function(val) {
		data.color = parseInt(val, 10);
            },
            'resolution': function(val) {
		data.res = val;
            },
            'filesize': function(val) {
		data.filesize = val;
            },
	    'profile-exif': function(cal) {
		data.exif = {};
		return data.exif;
	    }
        };
	for (var i = 0, len = parts.length; i < len; ++i){
	    var result = rgx.exec(parts[i]);
	    if (result) {
		var indent = result[1].length / 2;
		var key = result[2].toLowerCase();
		var val = result[3];
		if (1 == indent){
		    var handler = handle[key];
		    if (handler) {
			cur = handler(val);
		    }
		    else if (val) {
			data[key] = val;
			cur = null;
		    }
		    else {
			cur = data[key] = {};
		    }
		}
		else if (2 == indent) {
		    if (cur)
			cur[key] = val;
		}
	    }
	}
	var idx = self._iq.length;
	while (idx--)
	    self._iq[idx].call(self, null, self.data);
	self._identifying = false;
    });
    return self;
};
