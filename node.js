/* Node platform implementation */
"use strict";

// TODO: Keyboard input support

var pykgl = require("pykgl"),
    sdl = require("pyksdl2"),
    stbi = require("pykstbi"),
    dcl = require("dcl"),
    core = require("./core"),
    fs = require("fs");


sdl.init(sdl.INIT_VIDEO);

var Image = dcl(core.EventEmitter, {
  declaredClass: "bb4.node.Image",

  constructor: function (src) {
    this._complete = false;
    this._width = 0;
    this._height = 0;
    var that = this;
    fs.readFile(src, function(err, data) {
      if (err) {
        console.error(err);
        return;
      }
      var p = stbi.loadFromMemory(data, 4);
      that._data = p.data;
      that._width = p.width;
      that._height = p.height;
      that._complete = true;
      that.emit("load");
    });
  },
  isComplete: function() { return this._complete;},
  getWidth: function() {return this._width;},
  getHeight: function() {return this._height;},
});

// Maps SDL Window ID to VideoEngine
var sdlVideoEngines = {};

var VideoEngine = dcl(core.VideoEngine, {

  declaredClass: "bb4.node.VideoEngine",

  constructor: function(args) {
    var width = this._width = args.width || 640;
    var height = this._height = args.height || 480;
    var sdlwindow = sdl.createWindow("node",
      sdl.WINDOWPOS_UNDEFINED,
      sdl.WINDOWPOS_UNDEFINED,
      width,
      height,
      sdl.WINDOW_SHOWN | sdl.WINDOW_OPENGL | sdl.WINDOW_RESIZABLE
      );
    var glcontext = sdl.glCreateContext(sdlwindow);
    //sdl.glSetSwapInterval(0);
    var gl = new pykgl.WebGLRenderingContext(null, {});
    this._sdlwindow = sdlwindow;
    this._glcontext = glcontext;
    this.gl = gl;

    var texImage2D = gl.texImage2D;
    gl.texImage2D = function(target, level, internalformat, format, type, image) {
      if (typeof image === "object") {
      var width = image._width;
      var height = image._height;
      var border = 0;
      var format = gl.RGBA; //Definitely RGBA
      var type = gl.UNSIGNED_BYTE;
      var srcdata = image._data;
      var data;
      // We have to flip the data
      data = new Buffer(srcdata.length);
      for (var y = 0; y < height; ++y) {
      srcdata.copy(data, y * width * 4, (height - y - 1) * width * 4, (height - y ) * width * 4);
      }
      return texImage2D.call(this, target, level, internalformat, width, height, border, format, type, data);
      } else {
      return texImage2D.apply(this, arguments);
      }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    // Construct OpenGL Enum to String table
    this.glEnums = {};
    for (var propertyName in gl) {
      if (typeof gl[propertyName] == "number") 
        this.glEnums[gl[propertyName]] = propertyName; 
    }
    this._currentImmediate = null;
    sdlVideoEngines[sdl.getWindowID(sdlwindow)] = this;
  },

  render: dcl.superCall(function(sup) {
    return function() {
      if (sup) sup.call(this);
      sdl.glSwapWindow(this._sdlwindow);
    }
  }),

  getImage: function(src) {
    var y = new Image(src);
    return y;
  },

  getWidth: function() {return this._width;},
  getHeight: function() {return this._height;},
});

var Conductor = dcl([core], {
  declaredClass: "bb4.node.Conductor",

  play: function() {
    // Runs update continiously
    var that = this;
    var lastFpsTime = new Date().getTime(),
      frameCount = 0;

    function draw() {
      that._currentImmediate = setImmediate(draw);
      var now = new Date().getTime();
      that.update(now);
      var now = new Date().getTime();
      if (now - lastFpsTime >= 1000) {
        var fps = frameCount / (now - lastFpsTime) * 1000;
        frameCount = 0;
        lastFpsTime = now;
        console.log("FPS:", fps);
      }
      frameCount += 1;
    }

    that._currentImmediate = setImmediate(draw);
  },
});

for (var exportName in core) {
  if (exportName[0] != "_") {
    Conductor[exportName] = core[exportName];
  }
}

Conductor.VideoEngine = VideoEngine;
Conductor.prototype.VideoEngine = VideoEngine;

var sdlevent = {};

function handleEvents() {
  while(sdl.pollEvent(sdlevent)) {
    switch(sdlevent.type) {
      case sdl.KEYDOWN:
      case sdl.KEYUP:
        var videoEngine = sdlVideoEngines[sdlevent.key.windowID];
        if (videoEngine) {
          var key = sdl.getKeyName(sdlevent.key.keysym.sym);
          var ev = {key: key};
          var event = sdlevent.key.state == sdl.PRESSED ? "keydown" : "keyup";
          videoEngine.emit(event, ev);
        }
        continue;
      case sdl.WINDOWEVENT:
        switch(sdlevent.window.event) {
          case sdl.WINDOWEVENT_RESIZED:
            var videoEngine = sdlVideoEngines[sdlevent.window.windowID];
            if (videoEngine) {
              var ev = {width: sdlevent.window.data1, height: sdlevent.window.data2};
              videoEngine._width = sdlevent.window.data1;
              videoEngine._height = sdlevent.window.data2;
              videoEngine.emit("resize", ev);
            }
            continue;
        }
        continue;
      default:
        continue;
    }
  }

  setImmediate(handleEvents);
}

setImmediate(handleEvents);


module.exports = Conductor;
// vim: set expandtab tabstop=2 shiftwidth=2:
