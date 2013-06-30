// ======================================================================
// Playlist
var fs = require('fs');
var path = require('path');
var url = require('url');
var params = require('./params');
var utils = require('./utils');
var Queue = require('./queue');
var Base = require('./base');
var Viewport = require('./viewport');
var execfunc = require('child_process').exec;
var m3u8 = require('m3u8');
var ffprobe = require('node-ffprobe');

// Constructor
function Playlist(options) {
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

Playlist.prototype = utils.inherits(Base, {
    
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
    	Playlist.parseFile(this.source, function(err,actualUrl) 
    	{
    		if (err) {
    			if (err.code = 1)
    				err = 'bad image';
        		return cb & cb(err);
    		}

    		ffprobe(actualUrl, function(err, data) {
    			if (err) {
    				if (err.code == 1)
    				    err = 'bad image';
    				return cb && cb(err);
    			    }
    			
    			    if (! (data.streams ))
    			    	return cb && cb('bad image');
    			    
    			    for (var i = 0; i < data.streams.length; i++)
    			    {
    			    	if (data.streams[i].codec_type == "video")
    			    	{
    	    			    // Save format info
    	    			    this.format = data.streams[i].codec_name;
    	    			    this.width = data.streams[i].width;
    	    			    this.height = data.streams[i].height;
    			    		var size = 
    			    			{
    			    				width : this.width,
    			    				height : this.height
    			    			};
    	    			    this.viewport = new Viewport(size);
    	    			    err = 0;
    			    	}
    			   	}
    
    			    cb && cb(err);
    			
    		}.bind(this));
    		
    	}.bind(this));
    },

    identify: function identify(cb) {
    	err = 0;
    	data = 0;
    	cb && cb(err, data);
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
Playlist.getErrorImage = function getErrorImage() {
    if (! errorImage)
	errorImage = new Image(params.errorImageOptions);
    return errorImage;
};

// Sample images
Playlist.getSampleImageFiles = function getSampleImageFiles(cb) {
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

// ----------------------------------------------------------------------
// Export

module.exports = Playlist;

// ----------------------------------------------------------------------

Playlist.parseFile = function(infile, cb)
{
    var self = this;
    var url = null;
    var err = 1;
    if (!cb || !infile)
    	return self;

    var parser = m3u8.createStream();
    var file   = fs.createReadStream(infile);
    file.pipe(parser);

    parser.on('item', function(item) {
    	url =  item.get('uri');
    	err = null;
    	//cb && cb(err, url);
    });
    parser.on('m3u', function(m3u) {
    	cb && cb(err, url);
      // fully parsed m3u file
    });
    
};

// ffprobe identify ignores exif tags
ffprobe.identify = function(callback){
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
    
    var parser = m3u8.createStream();
    var file   = fs.createReadStream(self.source);
    file.pipe(parser);

    parser.on('item', function(item) {
    	var cmd = "ffmpeg -i " + item.get('uri');
    	print(cmd);
      // emits PlaylistItem, MediaItem, StreamItem, and IframeStreamItem
    });
    parser.on('m3u', function(m3u) {
    	print("end");
      // fully parsed m3u file
    });
    
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
