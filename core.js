/* Pure Javascript Bouncy Boar implementation.
 * MUST NOT depend on any external APIs.
 * Integration with external APIs are provided via subclassing */
// BASE is for 
// TODO: Next project: Hardcore batching (Multiple materials in a single geom, Compiling multiple material programs into a single program) See http://ce.u-sys.org/Veranstaltungen/Interaktive%20Computergraphik%20(Stamminger)/papers/BatchBatchBatch.pdf That said, this is not important because we are targeting crappy Intel CPUs, which are not even good with shaders in the first place. For the FUTURE I guess.
// TODO: Re-add input support (IMPT)
// TODO: FunctionQueue works now. Now, make it easy to use! (???)
// TODO: Common ID
// TODO: A better skybox that uses 2D Textures (IMPT)
// TODO: Make Viewport fill whole screen (IMPT)
// FINISH ALL IMPT TODOs NOW and then CODE DUMP!
"use strict";
(function(factory) {
  if (typeof define != "undefined") {
    define(["dcl", "gl-matrix"], factory);
  } else if (typeof module != "undefined") {
    module.exports = factory(require("dcl"), require("gl-matrix"));
  } else {
    core = factory(dcl, glm);
  }
})(function(dcl, glm) {
  var vec2 = glm.vec2;
  var vec3 = glm.vec3;
  var quat = glm.quat;
  var mat4 = glm.mat4;
  var mat3 = glm.mat3;

  vec3.ZERO = vec3.create();

  var vec3X = glm.vec3.fromValues(1.0, 0.0, 0.0); 
  var vec3Y = glm.vec3.fromValues(0.0, 1.0, 0.0);
  var vec3Z = glm.vec3.fromValues(0.0, 0.0, 1.0);


  vec3.lerp = function (out, a, b, t) {
    var ax = a[0],
      ay = a[1],
      az = a[2];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    return out;
  };

  /* Extension functions */
  mat3.setFromAxes = function(out, xVec, yVec, zVec) {
    out.set(xVec);
    out.set(yVec, 3);
    out.set(zVec, 6);
    return out;
  }

  // Converts a rotation matrix mat3 into a quat
  quat.setFromMat3 = function(out, m) {
    var m11 = m[0], m12 = m[3], m13 = m[6],
      m21 = m[1], m22 = m[4], m23 = m[7],
      m31 = m[2], m32 = m[5], m33 = m[8],
			trace = m11 + m22 + m33,
			s,
      w, x, y, z; //outbound variables
		
		if( trace > 0 ) {
			s = 0.5 / Math.sqrt( trace + 1.0 );
			
			w = 0.25 / s;
			x = ( m32 - m23 ) * s;
			y = ( m13 - m31 ) * s;
			z = ( m21 - m12 ) * s;
		} else if ( m11 > m22 && m11 > m33 ) {
			s = 2.0 * Math.sqrt( 1.0 + m11 - m22 - m33 );
			
			w = (m32 - m23 ) / s;
			x = 0.25 * s;
			y = (m12 + m21 ) / s;
			z = (m13 + m31 ) / s;
		} else if (m22 > m33) {
			s = 2.0 * Math.sqrt( 1.0 + m22 - m11 - m33 );
			
			w = (m13 - m31 ) / s;
			x = (m12 + m21 ) / s;
			y = 0.25 * s;
			z = (m23 + m32 ) / s;
		} else {
			s = 2.0 * Math.sqrt( 1.0 + m33 - m11 - m22 );
			
			w = ( m21 - m12 ) / s;
			x = ( m13 + m31 ) / s;
			y = ( m23 + m32 ) / s;
			z = 0.25 * s;
		}
    out[0] = x; out[1] = y; out[2] = z; out[3] = w;
    return out;
  }

  quat.setFromAxes = function(out, xVec, yVec, zVec) {
    var m = mat3.create();
    mat3.setFromAxes(m, xVec, yVec, zVec);
    return quat.setFromMat3(out, m);
  }

  var objectCounter = 0;

  var Instance = dcl(null, {

    declaredClass: "bb4.core.Instance",

    constructor: function(args) {
      this.id = objectCounter++;
    },
  });
  
  // ===========================================================
  // Event System

  // Does event bubbling have any use? Probably not.
  var EventEmitter = dcl(null, {

    declaredClass: "bb4.core.EventEmitter",

    constructor: function(args) {
      this._callbacks = {};
      this._callbackCtr = 0;
    },


    on: function(event, callback, numTimes) {
      if (!numTimes) numTimes = 0;
      if (!(event in this._callbacks))
        this._callbacks[event] = {};
      var callbackId = this._callbackCtr++;
      if (numTimes > 0) {
        var num = numTimes;
        var cBack = function() {
          if (--num <= 0)
            this.removeListener(event, callbackId);
          return callback.apply(this, arguments);
        };
      } else cBack = callback;
      this._callbacks[event][callbackId] = cBack;
      return callbackId;
    },

    once: function(event, callback) {
      return this.on(event, callback, 1);
    },

    removeListener: function(event, callbackId) {
      if (this._callbacks[event]) delete this._callbacks[event][callbackId];
    },

    emit: function(event, e, target) {
      if (!target) {
        //if (!(event in this._slots)) throw "Invalid event";
        target = this;
      }
      var bubble = true;
      if (event != "*" && this._callbacks["*"]) { //handle wildcard event
        var callbacks = this._callbacks["*"];
        for (var callbackId in callbacks)
          callbacks[callbackId].call(this, e, target, callbackId, event);
      }
      if (this._callbacks[event]) {
        var callbacks = this._callbacks[event];
        for (var callbackId in callbacks)
          if (callbacks[callbackId].call(this, e, target, callbackId, event)) bubble = false;
      }
      if (bubble && this.parent && this.parent.emit) this.parent.emit(event, e, target);
    },
  });


  var TS_WORLD = 1,
    TS_PARENT = 2,
    TS_LOCAL = 3;

  // ============================================================

  var Node = dcl(Instance, {
    // Implements parent-child relationship

    declaredClass: "bb4.core.Node",

    constructor: function(args) {
      if (!args) args = {};
      this.parent = args.parent || null;
      this.children = args.children || {};
    },

    _onParentUpdate: function() {
      for (var nodeid in this.children) this.children[nodeid]._onParentUpdate();
    },

    _onUpdate: function() {
      for (var nodeid in this.children) this.children[nodeid]._onParentUpdate();
      if (this.parent) this.parent._onChildUpdate();
    },

    _onChildUpdate: function() {

    },

    _setParent: function(node) {
      this.parent = node;
      this._onUpdate();
    },

    addChild: function(node) {
      // Remove node from previous parent (if any)
      if (node.parent) node.parent.removeChild(node);
      node._setParent(this);
      this.children[node.id] = node;
      this._onChildUpdate();
    },

    removeChild: function(node) {
      var nodeid = Object.prototype.toString.call(node) == "[object Number]" ? node : node.id;
      var child = this.children[nodeid];
      if (child) {
        child._setParent(null);
        delete this.children[nodeid];
        this._onChildUpdate();
        return true;
      } else return false;
    },
  });

  // ==============================================================
  // Command Queue System
   
  /*
  function funcQueue(f) {
    f.functionQueueFunc = f;
    return f;
  };*/

  var FunctionQueue = dcl(EventEmitter, {

    declaredClass: "bb4.FunctionQueue",

    constructor: function(args) {
      //this.target = args.target || null;
      this.queue = []; //Not completed async functions.
      this.numRunning = 0;
      this.funcCounter = 0;
      this.running = args.running || false; //If true, if there are no queued functions, all
      // new functions added will start immediately.
      //if(this.target) this.ctx(this.target);
    },

    /*
    ctx: function(c) {
      this.target = c;
      for (var funcName in c) {
        if (c[funcName] && c[funcName].functionQueueFunc) {
          var f = c[funcName].functionQueueFunc;
          this[funcName] = f;
        }
      }
      return this;
    },*/

    run: function() {
      // Run the Queue.
      this.running = true;
      this.emit("run");
    },

    fireComplete: function(funcId) {
      // Remove this function from queue!
      var i = this.queue.indexOf(funcId);
      if (i > -1) {
        this.queue.splice(i, 1);
      }
      this.numRunning --;
      this.emit("start" + funcId);
      // funcId has completed!
      this.emit("complete" + funcId);
      if (this.numRunning <= 0) {
        this.emit("complete"); //No more functions left in the queue
      }
    },

    async: function(func) {
      // I start running once the function before me begins running
      var that = this,
        funcId = this.funcCounter++,
        waitFuncId;
      this.queue.push(funcId);
      if (this.queue.length - 1 > 0) {
        // There is a function which we need to wait for.
        waitFuncId = this.queue[this.queue.length - 2];
        this.once("start" + waitFuncId, function() {
          that.numRunning ++;
          func.call(that, funcId);
          that.emit("start" + funcId); //Fire my start event (run callbacks only after function is run to preserve ordering)
        });
      } else if (this.running) {
        // There is no function that we need to wait for. Start immeduately
        this.numRunning ++;
        func.call(this, funcId);
      } else {
        this.once("run", function() {
          that.numRunning ++;
          func.call(that, funcId);
          that.emit("start" + funcId);
        });
      }
      return this;
    },

    asyncQueue: function(queue) {
      // Run a queue in an async manner. This is useful when you want to run
      // events which are blocking with respect to each other, but you want
      // to run them, as a whole, async.
      this.async(function(funcId) {
        var that = this;
        queue.once("complete", function() {
          that.fireComplete(funcId);
        });
        queue.run();
      });
    },

    blockX: function() {

    },

    block: function() {

    },

    sync: function(func) {
      //I will wait until all functions before me complete before running
      if (!func) func = function(funcId){this.fireComplete(funcId);};
      var that = this,
      funcId = this.funcCounter++,
      numRemaining = this.queue.length, //Number of functions left to wait for
      callback = function() {
        if (--numRemaining <= 0) {
          //that.started[funcId] = true; //Add myself to started list
          that.numRunning ++;
          func.call(that, funcId);
          that.emit("start" + funcId); //Fire my start event (run callbacks only after function is run to preserve ordering)
        }
      };
      if (this.queue.length > 0) {
        for (var i = 0; i < this.queue.length; ++i) {
          this.once("complete" + this.queue[i], callback);
        }
      } else if (this.running) {
        // There is nothing to wait for. Start immediately.
        that.numRunning ++;
        func.call(this, funcId);
      } else {
        this.once("run", function() {
          that.numRunning ++;
          func.call(that, funcId);
          that.emit("start" + funcId);
        });
      }
      this.queue.length = 0;
      this.queue.push(funcId);
      return this;
    },

    func: function(func) {
      // Call a function
      var args = [];
      for (var i = 1; i < arguments.length; ++i)
        args.push(arguments[i]);
      this.async(function(funcId) {
        func.call(null, args);
        this.fireComplete(funcId);
      });
      return this;
    },

  });

  /*
  var FunctionQueueMixin = dcl(null, {
    declaredClass: "FunctionQueueMixin",

    constructor: function(args) {
      this._functionQueue = new FunctionQueue({running: true, target: this});
      for (var funcName in this) {
        if (this[funcName] && this[funcName].functionQueueFunc) {
          var f = this[funcName].functionQueueFunc;
          this[funcName] = function() {
            return f.apply(this._functionQueue, arguments);
          }
        }
      }
    },

    wait: funcQueue(function() {

    }),
  });
  */

  // ==============================================================
  
  var SpatialNode = dcl(Node, {

    declaredClass: "bb4.SpatialNode",

    constructor: function(args) {
      if (!args) args = {};
      this.logicEngine = args.logicEngine || this.logicEngine || null;
      this.localPosition = vec3.clone(args.localPosition || [0, 0, 0]);
      this.worldPosition = vec3.create();
      this.localOrientation = quat.clone(args.localOrientation || [0, 0, 0, 1]);
      this.worldOrientation = quat.create();
      this.localScale = vec3.clone(args.localScale || [1, 1, 1]);
      this.worldScale = vec3.fromValues(1, 1, 1);
      this.mMatrix = mat4.create();
      this._worldOutdated = true;
    },

    _onParentUpdate: dcl.superCall(function(sup) {
      return function() {
        this._worldOutdated = true;
        sup.call(this);
      };
    }),

    _onUpdate: dcl.superCall(function(sup) {
      return function() {
        this._worldOutdated = true;
        sup.call(this);
      };
    }),

    updateWorldProperties: function() {
      var parent = this.parent;
      if (!this._worldOutdated) return false;

      if (parent) {
        // Ensure parent's world properties are updated
        parent.updateWorldProperties(); 
        // Combine orientation with that of parent
        quat.mul(this.worldOrientation, parent.worldOrientation, this.localOrientation); 
        // Update scale
        vec3.mul(this.worldScale, parent.worldScale, this.localScale);
        // Update position based on parent's orientation and scale
        // this.worldPosition = parent.worldOrientation * (parent.worldScale * this.localPosition) + parent.worldPosition
        vec3.mul(this.worldPosition, parent.worldScale, this.localPosition);
        vec3.transformQuat(this.worldPosition, parent.worldOrientation, this.worldPosition);
        vec3.add(this.worldPosition, this.worldPosition, parent.worldPosition);
      } else {
        // Root node, no parent. Hence, worldX = localX, where X={Position,Orientation,Scale}
        vec3.copy(this.worldPosition, this.localPosition);
        quat.copy(this.worldOrientation, this.localOrientation);
        vec3.copy(this.worldScale, this.localScale);
      }
      // Finally, update world model transformation matrix
      this._worldOutdated = false;
      mat4.fromRotationTranslation(this.mMatrix, this.worldOrientation, this.worldPosition);
      mat4.scale(this.mMatrix, this.mMatrix, this.worldScale);
      return true;
    },

    setDirection: function(vec, relativeTo, up) {
      var parent = this.parent;
      var targetDir = vec3.create();
      if (!up) up = vec3Y;
      if (!relativeTo) relativeTo = TS_WORLD;
      // Do nothing if given a zero vector
      if (vec3.squaredLength(vec) < 0.0000001) return;
      // Ensure vec is normalised
      vec3.normalize(targetDir, vec);
      // Transform target direction to world space
      switch (relativeTo) {
        case TS_PARENT:
          if (parent) {
            parent.updateWorldProperties();
            vec3.transformQuat(targetDir, targetDir, parent.worldOrientation);
          }
          break;
        case TS_LOCAL:
          this.updateWorldProperties();
          vec3.transformQuat(targetDir, targetDir, this.worldOrientation);
          break;
      }
      // Calculate target orientation relative to world space
      // (assuming a fixed up axis) (and so no rolling)
      var xvec = glm.vec3.create();
      var yvec = glm.vec3.create();
      var zvec = targetDir;
      glm.vec3.cross(xvec, up, zvec);
      glm.vec3.normalize(xvec, xvec);
      glm.vec3.cross(yvec, zvec, xvec);
      // Construct World Orientation Quat
      quat.setFromAxes(this.worldOrientation, xvec, yvec, zvec);
      // TODO: handle localDirection like OGRE
      // Turn worldOrientation back into localOrientation
      if (parent) {
        parent.updateWorldProperties();
        var parentInverseOrientation = quat.create();
        quat.invert(parentInverseOrientation, parent.worldOrientation);
        quat.multiply(this.localOrientation, parentInverseOrientation, this.worldOrientation);
      } else {
        quat.copy(this.localOrientation, this.worldOrientation);
      }
      this._onUpdate();
      return this;
    },

    lookAt: function(target, relativeTo, up, reverse) {
      if (!relativeTo) relativeTo = TS_WORLD;
      switch (relativeTo) {
        case TS_WORLD: 
          this.updateWorldProperties();
          var origin = this.worldPosition;
          break;
        case TS_PARENT:
          var origin = this.localPosition;
          break;
        case TS_LOCAL:
          var origin = [0, 0, 0];
          break;
      }
      var myTarget = glm.vec3.create();
      vec3.subtract(myTarget, target, origin);
      if (reverse) vec3.negate(myTarget, myTarget);
      this.setDirection(myTarget, relativeTo, up);
      return this;
    },

    yaw: function(rad) {
      quat.rotateY(this.localOrientation, this.localOrientation, rad);
      this._onUpdate();
      return this;
    },

    pitch: function(rad) {
      quat.rotateX(this.localOrientation, this.localOrientation, rad);
      this._onUpdate();
      return this;
    },

    roll: function(rad) {
      quat.rotateZ(this.localOrientation, this.localOrientation, rad);
      this._onUpdate();
      return this;
    },

    _translate: function(out, d, relativeTo) {
      if (!relativeTo) relativeTo = TS_PARENT;
      var parent = this.parent,
        target = vec3.clone(d);
      switch (relativeTo) {
        case TS_LOCAL:
          // target = localOrientation * d
          vec3.transformQuat(target, d, this.localOrientation);
          break;
        case TS_WORLD:
          if (parent) {
            parent.updateWorldProperties();
            //target = (parent.worldOrientation.inverse() * d) / parent.worldScale
            var parentWorldOrientationInverse = quat.create();
            quat.invert(parentWorldOrientationInverse, parent.worldOrientation);
            vec3.transformQuat(target, d, parentWorldOrientationInverse);
            vec3.divide(target, target, parent.worldScale);
          } 
          break;
      }
      // localPosition += target
      vec3.add(out, this.localPosition, target);
      return out;
    },

    translate: function(d, relativeTo) {
      this._translate(this.localPosition, d, relativeTo);
      this._onUpdate();
      return this;
    },

    translateS: function(queue, d, relativeTo, s, interp) {
      // For now we just do linear interpolation
      var logicEngine = this.logicEngine,
        that = this;
      if (!interp) interp = vec3.lerp;

      queue.async(function(funcId) {
        var queue = this,
        vecStart = vec3.clone(that.localPosition),
        vecTarget = that._translate(vec3.create(), d, relativeTo),
        stepCounter = 0;
        logicEngine.on("step", function(e, target, callbackId) {
          stepCounter++;
          interp(that.localPosition, vecStart, vecTarget, (stepCounter / s));
          that._onUpdate();
          if (stepCounter >= s) {
            logicEngine.removeListener("step", callbackId);
            queue.fireComplete(funcId);
          }
        });
      });
      return this;
    },

  });

  // ================================================================

  function isPowerOfTwo(x) {
    return (x & (x - 1)) == 0;
  }
   
  function nextHighestPowerOfTwo(x) {
    --x;
    for (var i = 1; i < 32; i <<= 1) {
      x = x | x >> i;
    }
    return x + 1;
  }

  var _textureDefaultData = new Uint8Array([0, 0, 255, 255]);

  var _object_plane_x = new Float32Array([1, 0, 0, 0]);
  var _object_plane_y = new Float32Array([0, 1, 0, 0]);
  var _object_plane_z = new Float32Array([0, 0, 1, 0]);

  // TODO: TextureUnit class to represent Texture Unit so the same texture
  // data can be used.
  // Represents a Texture Unit
  // texgen: normal_map, reflection_map, sphere_map
  var Texture = dcl(null, {

    declaredClass: "bb4.core.Texture",

    constructor: function(args) {
      if (typeof args != "object") args = {};
      var videoEngine = this.videoEngine = args.videoEngine || this.videoEngine || console.error("args.videoEngine");
      var gl = videoEngine.gl;
      this.type = args.type || "TEXTURE_2D";
      this.gltexture = gl.createTexture();
      var images = args.images || {};
      this.texgen = args.texgen || null;
      this.images = {};
      for (var imageType in images) 
        this.loadImage(imageType, this.images[imageType]);
    },

    bind: function() {
      var gl = this.videoEngine.gl,
        gltexture = this.gltexture,
        gltexturetype = this.type;
      gl.bindTexture(gl[this.type], this.gltexture);
      gl.enable(gl[this.type]);
      gl.texParameteri(gl[this.type], gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl[this.type], gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    },

    unbind: function() {
      var gl = this.videoEngine.gl;
      gl.disable(gl[this.type]);
    },

    loadImage: function(imageType, src) {
      // src: String or Image()
      var gl = this.videoEngine.gl, that = this,
        clearImage = function() {
          gl.texImage2D(gl[imageType], 0, gl.RGBA, 1, 1, 0, gl.RGBA,
              gl.UNSIGNED_BYTE, _textureDefaultData);
          gl.generateMipmap(gl[that.type]);
        };
      this.bind();
      if (!src) {
        clearImage();
        this.unbind();
        return this;
      } else if (typeof src == "string")
        src = this.videoEngine.getImage(src);
      if (src.isComplete()) {
        this.images[imageType] = src;
        gl.texImage2D(gl[imageType], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.generateMipmap(gl[this.type]);
      } else {
        clearImage()
        src.on("load", function() {
          that.loadImage(imageType, src);
        });
      } 
      this.unbind();
      return this;
      /*
      if (!isPowerOfTwo(img.width) || !isPowerOfTwo(img.height)) {
        //Scale up the image to the next highest power of two
        var canvas = document.createElement("canvas");
        canvas.width = nextHighestPowerOfTwo(img.width);
        canvas.height = nextHighestPowerOfTwo(img.height);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img = canvas;
      }*/
    },
  });

  var Texture2 = dcl(Texture, {

    declaredClass: "bb4.core.Texture2",

    constructor: function(args) {
      if (typeof args == "string") {
        args = {src: args};
      } else if (typeof args != "object") args = {};
      this.type = "TEXTURE_2D";
      if (args.src) this.loadImage("TEXTURE_2D", args.src);
    },
  });

  var TextureCube = dcl(Texture, {

    declaredClass: "bb4.core.TextureCube",

    constructor: function(args) {
      // new TextureCube([+X, -X, +Y, -Y, +Z, -Z]); // length 6
      // new TextureCube([+X/-X/+Z/-Z, +Y/-Y]); //length 2 (for Skybox)
      // new TextureCube([+X/-X/+Z/-Z, +Y, -Y]); //length 3 (For skybox)
      // new TextureCube(src) //string

      function perm(x, y) {
        var out = [];
        for (var i = 0; i < x.length; ++i) {
          for (var j = 0; j < y.length; ++j) {
            out.push(y[j] + x[i]);
          }
        }
        return out;
      }
      if (typeof args == "string") {
        args = {src: [args]};
      } else if (typeof args != "object") args = {};
      this.type = "TEXTURE_CUBE_MAP";
      var src = args.src || [];
      if (typeof src == "string") src = [src];
      switch (src.length) {
        case 1:
          var x = perm(["X", "Y", "Z"], ["POSITIVE_", "NEGATIVE_"]);
          for (var i = 0; i < x.length; ++i) {
            this.loadImage("TEXTURE_CUBE_MAP_" + x[i], src[0]);
          }
          break;
        case 2:
          var x = perm(["X", "Y", "Z"], ["POSITIVE", "NEGATIVE_"]);
          for (var i = 0; i < x.length; ++i) {
            this.loadImage("TEXTURE_CUBE_MAP_" + x[i], src[i]);
          }
          break;
      };
    },

    bind: dcl.superCall(function(sup) {
      return function() {
        sup.call(this);
        var gl = this.videoEngine.gl;
        if (gl.texGen) {
          switch(this.texgen) {
            case "skybox":
              // WARNING: skybox w/ cubemaps are SLOW on Intel Craphics.
              gl.texGen(gl.S, gl.TEXTURE_GEN_MODE, gl.OBJECT_LINEAR);
              gl.texGen(gl.T, gl.TEXTURE_GEN_MODE, gl.OBJECT_LINEAR);
              gl.texGen(gl.R, gl.TEXTURE_GEN_MODE, gl.OBJECT_LINEAR);
              gl.texGen(gl.S, gl.OBJECT_PLANE, _object_plane_x);
              gl.texGen(gl.T, gl.OBJECT_PLANE, _object_plane_y);
              gl.texGen(gl.R, gl.OBJECT_PLANE, _object_plane_z);
              gl.enable(gl.TEXTURE_GEN_S);
              gl.enable(gl.TEXTURE_GEN_T);
              gl.enable(gl.TEXTURE_GEN_R);
              break;
            case "reflection":
              gl.texGen(gl.S, gl.TEXTURE_GEN_MODE, gl.REFLECTION_MAP);
              gl.texGen(gl.T, gl.TEXTURE_GEN_MODE, gl.REFLECTION_MAP);
              gl.texGen(gl.R, gl.TEXTURE_GEN_MODE, gl.REFLECTION_MAP);
              gl.enable(gl.TEXTURE_GEN_S);
              gl.enable(gl.TEXTURE_GEN_T);
              gl.enable(gl.TEXTURE_GEN_R);
              break;
          }
        }
      };
    }),

    unbind: dcl.superCall(function(sup) {
      return function() {
        sup.call(this);
        var gl = this.videoEngine.gl;
        if (gl.texGen) {
          switch(this.texgen) {
            case "skybox":
            case "reflection":
              gl.disable(gl.TEXTURE_GEN_S);
              gl.disable(gl.TEXTURE_GEN_T);
              gl.disable(gl.TEXTURE_GEN_R);
              break;
          }
        }
      };
    }),

  });


  // =================================================
  var Shader = dcl(Instance, {
    declaredClass: "bb4.core.Shader",

    constructor: function(args) {
      if (!args) args = {};
      this.videoEngine = args.videoEngine || this.videoEngine || console.error("args.videoEngine");
      this.type = args.type || null;
      this.content = args.content || null;
      this._glshader = null;
      this.needUpdate = true;
    },

    getInternalShader: function() {
      // Returns internal shader object
      if (this.needUpdate) this.compile();
      return this._glshader;
    },

    compile: function() {
      var content = this.content, type = this.type;
      if (!content) return false;
      if (!type) {
        // Attempt to determine type
        // TODO: Probably should be smarter (e.g. putting gl_Position
        // in a comment will trick this)
        if (content.indexOf("gl_Position") > -1) {
          this.type = type = "VERTEX_SHADER";
        } else if (content.indexOf("gl_FragColor") > -1) {
          this.type = type = "FRAGMENT_SHADER";
        } else {
          console.error("Could not detect shader type");
          return false;
        }
      }
      var gl = this.videoEngine.gl;
      var glshader = gl.createShader(gl[type]);
      gl.shaderSource(glshader, content);
      gl.compileShader(glshader);
      if (!gl.getShaderParameter(glshader, gl.COMPILE_STATUS)) {
        console.error("Could not compile shader:", gl.getShaderInfoLog(glshader));
        return false;
      }
      this._glshader = glshader;
      this.needUpdate = false;
    },
  });


  // =================================================
  // Skeletal Animation
  
  var Bone = dcl(SpatialNode, {});

  // TODO: Function to flatten bone positions (vec3)
  // TODO: Function to flatten bone orientations (vec4)

  // =================================================
  
  // TODO: Material should allow parenting!! 
  // OPTIMIZE gl.useProgram!

  // Roles of Shaders:
  // 1. Applies runtime modifiers (e.g. the bones system)

  var Material = dcl(Instance, {

    declaredClass: "bb4.core.Material",

    constructor: function(args) {
      if (!args) args = {};
      this.videoEngine = args.videoEngine || this.videoEngine || console.error("args.videoEngine");
      this.bones = args.bones || [];
      this.textures = args.textures || [];
    },

    // TODO: Bones system

    clearBones: function() {
      this.bones = [];
    },

    addBones: function() {
      for (var i = 0; i < arguments.length; ++i) {
        var bone = arguments[i];
        bone["_boneIndex" + this.id] = this.bones.push(bone) - 1;
      }
    },

    bind: function(viewport, camera) {
      console.error(this.declaredClass, "bind not implemented");
      return false;
    },

    render: function(geom, nodes) {
      console.error(this.declaredClass, "render not implemented");
      return false;
    },
    
    unbind: function() {

    },

  });


  // Material using the fixed pipeline
  var FixedMaterial = dcl(Material, {
    
    declaredClass: "bb4.core.FixedMaterial",

    constructor: function(args) {
      if (!args) args = {};
      this.mvMatrix = mat4.create();
    },

    bind: function(viewport, camera) {
      var gl = this.videoEngine.gl;
      // Switch back to fixed pipeline
      if (gl.useProgram) {
        gl.useProgram(null);
      }
      // Upload Projection Matrix
      gl.matrixMode(gl.PROJECTION);
      gl.loadMatrix(viewport.pMatrix);
      // Bind textures
      for (var i = 0; i < this.textures.length; ++i) {
        var texture = this.textures[i];
        gl.activeTexture(gl["TEXTURE" + i]);
        texture.bind();
      }
      camera.updateWorldProperties();
      this.vMatrix = camera.vMatrix;
      gl.matrixMode(gl.MODELVIEW);
      return true;
    },

    render: function(geom, nodes) {
      var gl = this.videoEngine.gl,
      glbuffer = geom.getGLBuffer();

      if (!glbuffer) return false;

      // Bind vertices
      gl.bindBuffer(gl.ARRAY_BUFFER, glbuffer);
      gl.enableClientState(gl.VERTEX_ARRAY);
      gl.vertexPointer(3, gl.FLOAT, geom.stride, geom.vertexOffset);
      // Bind vertex normals
      gl.enableClientState(gl.NORMAL_ARRAY);
      gl.normalPointer(gl.FLOAT, geom.stride, geom.vertexNormalOffset);
      // Bind UV Layers (depends on number of textures, activeTexture is set appropriately)
      for (var i = 0; i < this.textures.length; ++i) {
        if (geom.uvOffsets[i]) {
          gl.enableClientState(gl.TEXTURE_COORD_ARRAY);
          gl.clientActiveTexture(gl["TEXTURE" + i]);
          gl.texCoordPointer(2, gl.FLOAT, geom.stride, geom.uvOffsets[i]);
        }
      }
      // Draw triangles for each scenenode
      for (var nodeId in nodes) {
        var node = nodes[nodeId];
        node.updateWorldProperties(); //Ensure world properties updated.
        // Construct ModelView Matrix
        mat4.multiply(this.mvMatrix, this.vMatrix, node.mMatrix);
        gl.loadMatrix(this.mvMatrix);
        // DRAW
        gl.drawArrays(gl.TRIANGLES, 0, geom.numVertices);
      }

      return true;
    },

    unbind: function() {
      var gl = this.videoEngine.gl;
      for (var i = 0; i < this.textures.length; ++i) {
        var texture = this.textures[i];
        gl.activeTexture(gl["TEXTURE" + i]);
        texture.unbind();
      }
    },
  });

  // Material using Shader Program
  var ProgramMaterial = dcl(Material, {

    declaredClass: "bb4.core.ProgramMaterial",

    constructor: function(args) {
      if (!args) args = {};
      var shaders = this.shaders = args.shaders || [];
      for (var i = 0; i < shaders.length; ++i) {
        var shader = shaders[i];
        if (!dcl.isInstanceOf(shader, Shader)) {
          shaders[i] = new this.videoEngine.Shader(shader);
        }
      }
      this.glprogram = null;
      this.uniforms = args.uniforms || {};
      this.uniformInfo = {}; //{loc: num, type: str, size:}
      this.attribInfo = {};
    },

    link: function() {
      var gl = this.videoEngine.gl, 
        glEnums = this.videoEngine.glEnums,
        shaders = this.shaders, i,
        glprogram = this.glprogram = gl.createProgram();
      for (i = 0; i < shaders.length; ++i) {
        var glshader = shaders[i].getInternalShader();
        if (glshader) gl.attachShader(glprogram, glshader);
        else {
          this.glprogram = null;
          return false;
        }
      }
      // Bind some attribs to known locations
      gl.linkProgram(glprogram);
      if (!gl.getProgramParameter(glprogram, gl.LINK_STATUS)) {
        console.error("Unable to initialise shader program");
        console.error(gl.getProgramInfoLog(glprogram));
        this.glprogram = null;
        return false;
      }
      // Populate Material Uniforms Information
      var numUniforms = gl.getProgramParameter(glprogram, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < numUniforms; ++i) {
        var uniformInfo = gl.getActiveUniform(glprogram, i);
        this.uniformInfo[uniformInfo.name] = {
          loc: gl.getUniformLocation(glprogram, uniformInfo.name),
          type: glEnums[uniformInfo.type], size: uniformInfo.size};
      }
      // Populate this.uniforms with current uniform data
      for (var uniformName in this.uniformInfo) {
        var uniformLoc = this.uniformInfo[uniformName].loc;
        this.uniforms[uniformName] = gl.getUniform(glprogram, uniformLoc);
      }
      // Populate Material Attributes Information
      var numAttribs = gl.getProgramParameter(glprogram, gl.ACTIVE_ATTRIBUTES);
      for (var i = 0; i < numAttribs; ++i) {
        var attribInfo = gl.getActiveAttrib(glprogram, i);
        this.attribInfo[attribInfo.name] = {
          loc: gl.getAttribLocation(glprogram, attribInfo.name),
          type: glEnums[attribInfo.type], size: attribInfo.size};
      }
      return glprogram;
    },

    bind: function(viewport, camera) {
      var engine = this.videoEngine, gl = engine.gl;
      // Link program is it has not been linked yet.
      if (!this.glprogram) {
        if (!this.link()) return false;
      }

      var glprogram = this.glprogram,
        attribInfo = this.attribInfo,
        uniformInfo = this.uniformInfo,
        locs = [];

      gl.useProgram(this.glprogram);

      // TODO: Add back the checks (need to reset this._pMatrixNode and this._vMatrixNode after every frame)
      //if (this._pMatrixNode != viewport.id) {
        if (this.uniformInfo["PMatrix"]) {
          var uniform = this.uniformInfo["PMatrix"];
          gl.uniformMatrix4fv(uniform.loc, false, viewport.pMatrix);
        }
        this._pMatrixNode = viewport.id;
      //}
      //if (this._vMatrixNode != camera.id) {
        if (this.uniformInfo["VMatrix"]) {
          var uniform = this.uniformInfo["VMatrix"];
          gl.uniformMatrix4fv(uniform.loc, false, camera.vMatrix);
        }
        this._vMatrixNode = camera.id;
      //}
      // Bind textures to their correct position
      for (var uniformName in this.uniformInfo) {
        var uniformType = this.uniformInfo[uniformName].type;
        if (uniformType == "SAMPLER_2D" || uniformType == "SAMPLER_CUBE") {
          var textureUnit = this.uniforms[uniformName];
          if (typeof textureUnit == "undefined") continue;
          var texture = this.textures[textureUnit];
          if (typeof texture == "undefined") continue;
          gl.activeTexture(gl["TEXTURE" + textureUnit]);
          texture.bind();
        }
      }
      return true;
    },

    render: function(geom, nodes) {
      var attribInfo = this.attribInfo,
      uniformInfo = this.uniformInfo,
      locs = [],
      gl = this.videoEngine.gl,
      glbuffer = geom.getGLBuffer();
      
      if (!glbuffer) return false;
      if (!this.glprogram) return false;

      // Bind vertices
      gl.bindBuffer(gl.ARRAY_BUFFER, glbuffer);
      var attrib = attribInfo["Vertex"];
      //TODO: OPTIMIZATION: Don't have to enable vertex attrib unless we are first material!
      gl.enableVertexAttribArray(attrib.loc);
      gl.vertexAttribPointer(attrib.loc, 3, gl.FLOAT, false, geom.stride, geom.vertexOffset);
      if (attribInfo["Normal"]) {
        var attrib = attribInfo["Normal"];
        locs.push(attrib.loc);
        gl.enableVertexAttribArray(attrib.loc);
        gl.vertexAttribPointer(attrib.loc, 3, gl.FLOAT, false, geom.stride, geom.vertexNormalOffset);
      }
      // Bind UV Layers (depends on the size of the TexCoord attribute)
      for (var i = 0; i < geom.numUvLayers; ++i) {
        if (attribInfo["TexCoord" + i]) {
          var attrib = attribInfo["TexCoord" + i];
          locs.push(attrib.loc);
          gl.enableVertexAttribArray(attrib.loc);
          gl.vertexAttribPointer(attrib.loc, 2, gl.FLOAT, false, geom.stride, geom.uvOffsets[i]);
        }
      }
      // Draw triangles for each SceneNode
      for (var nodeId in nodes) {
        var node = nodes[nodeId];
        node.updateWorldProperties(); //Ensure world properties updated.
        // Set the mMatrix
        if (uniformInfo["MMatrix"]) {
          gl.uniformMatrix4fv(uniformInfo["MMatrix"].loc, false, node.mMatrix);
        }
        gl.drawArrays(gl.TRIANGLES, 0, geom.numVertices);
      }
      // Cleanup
      // TODO: OPTIMIZATION: Don't have to disable the vertex attrib array unless
      // we are the last Material!
      for (var i = 0; i < locs.length; ++i) {
        gl.disableVertexAttribArray(locs[i]);
      }
      return true;
    },

    unbind: function() {
      var gl = this.videoEngine.gl;
      gl.useProgram(null);
    },

  });

  var FixedProgramMaterial = dcl(ProgramMaterial, {

    declaredClass: "bb4.core.FixedProgramMaterial",

    constructor: function(args) {
      // Set shaders
      this.shaders = [];
      this.genProgram();
    },

    genVertShader: function() {
      var header = [
        "attribute vec3 Vertex;",
        "uniform mat4 MMatrix;",
        "uniform mat4 VMatrix;",
        "uniform mat4 PMatrix;",
      ];
      var body = [
        "void main() {",
          "gl_Position = PMatrix * VMatrix * MMatrix * vec4(Vertex, 1.0);"
      ];
      var footer = ["}"];
      var textures = this.textures;
      for (var i = 0; i < textures.length; ++i) {
        var texture = textures[i];
        header.push("attribute vec4 TexCoord" + i + ";");
        header.push("varying highp vec4 vTexCoord" + i + ";");
        // Depends on texgen
        switch(texture.texgen) {
          case "skybox":
            body.push("vTexCoord" + i + " = vec4(Vertex, 0.0);");
            break;
          default:
            body.push("vTexCoord" + i + " = TexCoord" + i + ";");
            break;
        }
      }

      return header.concat(body).concat(footer).join("\n");
    },

    genFragShader: function() {
      var header = [];
      var body = [
        "void main() {",
        ];
      var footer = [
        "}"
        ];
      var textures = this.textures;
      for (var i = 0; i < textures.length; ++i) {
        // We just assume it is GL_REPLACE for each texture
        var texture = textures[i];
        header.push("varying highp vec4 vTexCoord" + i + ";");
        switch(texture.type) {
          case "TEXTURE_2D":
            header.push("uniform sampler2D Texture" + i + ";");
            body.push("gl_FragColor = texture2D(Texture" + i + ", vTexCoord" + i + ".st);");
            break;
          case "TEXTURE_CUBE_MAP":
            header.push("uniform samplerCube Texture" + i + ";");
            body.push("gl_FragColor = textureCube(Texture" + i + ", vTexCoord" + i + ".stp);");
            break;
        }
      }
      if (textures.length < 1) {
        // No texture, we just use a basic color (until we implement vertex colors)
        body.push("gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);");
      }
      return header.concat(body).concat(footer).join("\n");
    },

    genProgram: function() {
      // Run everytime anything is updated (e.g textures!)
      var videoEngine = this.videoEngine;
      this.shaders.length = 0;
      this.shaders.push(new videoEngine.Shader({content: this.genVertShader()}));
      this.shaders.push(new videoEngine.Shader({content: this.genFragShader()}));
      this.glprogram = null;
    },

  });

  // =================================================

  var SceneNode = dcl(SpatialNode, {
     
    declaredClass: "bb4.core.SceneNode",

    constructor: function(args) {
      if (!args) args = {};
      this.geoms = args.geoms || {}; //Mapping geomId -> Geom (for later lookup by Geomid)
    },

    addGeoms: function() {
      // attachGeoms(geom1, geom2...)
      for (var i = 0; i < arguments.length; ++i) {
        var geom = arguments[i];
        this.geoms[geom.id] = geom;
      }
      return this;
    },
  });

  // =================================================
  function mat4NormalMatrix(out, a) {
    glm.mat4.transpose(out, glm.mat4.invert(out, a));
    //Remove affine translation part.
    out[3] = out[7] = out[11] = out[12] = out[13] = out[14] = 0.0;
    out[15] = 1;
    return out;
  }
  // ========================================================
 
  var _GLBuffer = dcl(null, {

    declaredClass: "bb4.core._GLBuffer",

    constructor: function(engine, usage) {
      var gl = engine.gl;
      this.engine = engine;
      // this.size = data.length * 4;
      this.usage = usage;
      var glbuffer = this.glbuffer = gl.createBuffer();
    },

    update: function(data) {
      var gl = this.engine.gl;
      // TODO: gl.bufferSubData ???
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glbuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl[this.usage]);
    }
  });

  var Geom = dcl(Instance, {
    
    declaredClass: "bb4.core.Geom",

    constructor: function(args) {
      // NOTE: vertices, vertexNormals, uvLayers may be merged into a 
      // single array in the future to save buffer space
      // Vertex (3 floats) | Normal (3 floats) | UV 0 (2 floats) | UV 1 (2 floats) ...
      // TODO: Switch to:
      if (!args) args = {};
      var videoEngine = this.videoEngine = args.videoEngine || this.videoEngine || console.error("args.videoEngine");
      this.data = args.data || []; 
      this.numVertices = args.numVertices || 0;
      this.numUvLayers = args.numUvLayers || null;
      var numBuffers = this.numBuffers = args.numBuffers || 1; //Default only use 1 buffer 
      // Use more than one buffer if you plan on updating the Geom frequently
      // See also http://www.opengl.org/wiki/Buffer_Object_Streaming
      this.material = args.material || null;
      if (!args.material) console.error("No material");
      this.glbuffer = null;
      this.glbuffers = []; //Array of GLBuffers
      this.currentBufferNum = -1;
      this.bufferNeedUpdate = true;
      this.stride = null;
      this.vertexOffset = 0; //always 0
      this.vertexNormalOffset = 12; //always 12
      this.uvOffsets = null;
    },

    appendGeom: function(geom) {
      this.data = this.data.concat(geom.data);
      this.bufferNeedUpdate = true;
      return true;
    },

    appendVertex: function(pos, normal, uvLayers) {
      if (!uvLayers) uvLayers = [];
      if (this.numUvLayers != null) {
        if (uvLayers.length != this.numUvLayers) {
          console.error("uvLayers.length != this.numUvLayers");
          return false;
        }
      } else this.numUvLayers = uvLayers.length;
      this.data = this.data.concat(pos);
      this.data = this.data.concat(normal);
      for (var i = 0; i < uvLayers.length; ++i) {
        this.data = this.data.concat(uvLayers[i]);
      }
      this.numVertices += 1;
      this.bufferNeedUpdate = true;
      return true;
    },

    appendQuad: function() {
      var that = this, x = arguments;
      function v() {
        for (var j = 0; j < arguments.length; ++j) {
          var i = arguments[j];
          that.appendVertex(x[i * 3], x[i * 3 + 1], x[i * 3 + 2]);
        }
      }
      var a = 0, b = 1, c = 2, d = 3;
      v(a, b, c, c, d, a);
      return this;
    },

    updateBuffers: function() {
      var engine = this.videoEngine, gl = engine.gl;
      var nextBufferNum = this.currentBufferNum + 1;
      if (nextBufferNum > this.numBuffers) {
        nextBufferNum = 0;
      }
      var buffer = this.glbuffers[nextBufferNum];
      if (!buffer) {
        buffer = this.glbuffers[nextBufferNum] = new _GLBuffer(engine, "STATIC_DRAW");
      }
      buffer.update(this.data);
      this.currentBufferNum = nextBufferNum;
      this.stride  = (4 * 3) + (4 * 3) + (4 * 2 * this.numUvLayers);
      // Calculate UV offsets
      this.uvOffsets = [];
      for (var i = 0; i < this.numUvLayers; ++i) {
        this.uvOffsets.push((4 * 3) + (4 * 3) + (4 * 2 * i));
      }
      this.glbuffer = buffer.glbuffer;
      this.bufferNeedUpdate = false;
    },

    getGLBuffer: function() {
      // Returns updated VBO representing the geometry
      if (this.bufferNeedUpdate) this.updateBuffers();
      return this.glbuffer;
    },

    // Utilities

    appendPlane: function(u, v, width, height, widthSegments, heightSegments, wTranslate) {
      // Appends a plane geometry to the Geom
      var uDir = 1, vDir = 1;
      switch(u) {
        case "x": u = 0; break;
        case "-x": u = 0; uDir = -1; break;
        case "y": u = 1; break;
        case "-y": u = 1; uDir = -1; break;
        case "z": u = 2; break;
        case "-z": u = 2; uDir = -1; break;
      }
      switch(v) {
        case "x": v = 0; break;
        case "-x": v = 0; vDir = -1; break;
        case "y": v = 1; break;
        case "-y": v = 1; vDir = -1; break;
        case "z": v = 2; break;
        case "-z": v = 2; vDir = -1; break;
      }
      var w = 3 - u - v;

      // Vertices must be counter-clockwise
      var segWidth = width / widthSegments;
      var segHeight = height / heightSegments;
      var uvSegWidth = 1 / widthSegments;
      var uvSegHeight = 1 / heightSegments;
      var halfWidth = width / 2;
      var halfHeight = height / 2;
      var vertexNormal = [0, 0, 1]; //All vertex normals are the same (ARE THEY?)

      var faces = [];
      for (var ix = 0; ix < widthSegments; ++ix) {
        for (var iy = 0; iy < heightSegments; ++iy) {
          var a = [0, 0, 0], b = [0,0,0], c = [0,0,0], d = [0,0,0];
          a[u] = b[u] = (ix * segWidth - halfWidth) * uDir;
          b[v] = c[v] = (iy * segHeight - halfHeight) * vDir;
          c[u] = d[u] = ((ix + 1) * segWidth - halfWidth) * uDir;
          a[v] = d[v] = ((iy + 1) * segHeight - halfHeight) * vDir;
          a[w] = b[w] = c[w] = d[w] = wTranslate;
          var uA = [0, 0], uB = [0, 0], uC = [0, 0], uD = [0, 0];
          uA[0] = uB[0] = (ix * uvSegWidth);
          uB[1] = uC[1] = (iy * uvSegHeight);
          uC[0] = uD[0] = ((ix + 1) * uvSegWidth);
          uA[1] = uD[1] = ((iy + 1) * uvSegHeight);
          this.appendQuad(a, vertexNormal, [uA],
              b, vertexNormal, [uB],
              c, vertexNormal, [uC],
              d, vertexNormal, [uD]);
        }
      }
      return this;
     },
    
    appendCuboid: function(args) {
      if (typeof args != "object") args = {};
      var width = args.width || args.height || args.depth || 1;
      var height = args.height || args.width || args.depth || 1;
      var depth = args.depth || args.width || args.height || 1;
      var widthSegments = args.widthSegments || args.heightSegments || args.depthSegments || 1;
      var heightSegments = args.heightSegments || args.widthSegments || args.depthSegments || 1;
      var depthSegments = args.depthSegments || args.widthSegments || args.heightSegments || 1;
      var invert = args.invert || false;

      // Appends cuboid geometry
      var halfDepth = depth / 2;
      var halfWidth = width / 2;
      var halfHeight = height / 2;

      if (invert) var inv = function(x){ return x[0] == "-" ? x[1] : "-" + x; };
      else var inv = function(x){ return x; };
       
      // Positive Z
      this.appendPlane(inv("x"), "y", width, height, widthSegments, heightSegments, halfDepth);
      // Negative Z
      this.appendPlane(inv("-x"), "y", width, height, widthSegments, heightSegments,
          -halfDepth);
      // Positive X
      this.appendPlane(inv("-z"), "y", depth, height, depthSegments, heightSegments, halfWidth);
      // Negative X
      this.appendPlane(inv("z"), "y", depth, height, depthSegments, heightSegments, -halfWidth);
      // Positive Y
      this.appendPlane(inv("-x"), "z", width, depth, widthSegments, depthSegments, halfHeight);
      // Negative Y
      this.appendPlane(inv("x"), "z", width, depth, widthSegments, depthSegments, -halfHeight);
      return this;
    },
   });

  // ====================================================
   
  var Camera = dcl(SceneNode, {
     
    declaredClass: "bb4.core.Camera",

    constructor: function(args) {
      if (!args) args = {};
      this.vMatrix = glm.mat4.create();
    },

    cameraRender: function(viewport, scene) {
      this.updateWorldProperties();
      // Info: http://3dgep.com/?p=1700
      glm.mat4.invert(this.vMatrix, this.mMatrix);
      // Now, render Scene!
      scene.render(viewport, this);
    },
  });

  // ===============================================

  var SceneManager = dcl(null, {

    declaredClass: "bb4.core.SceneManager",

    constructor: function(args) {
      if (!args) args = {};
      this.videoEngine = args.videoEngine || this.videoEngine || console.error("args.videoEngine");
      this.main = {};
    },

    removeNode: function(node) {
      // Removes node from all render queues
      for (var materialId in this.main) {
        var geoms = this.main[materialId];
        for (var geomId in geoms) {
          var nodes = geoms[geomId];
          delete nodes[node.id];
        }
      }
    },

    addNode: function(node) {
      // TODO: Just adding all nodes to the main render queue for now
      for (var geomId in node.geoms) {
        var materialId = node.geoms[geomId].material.id;
        if (!(materialId in this.main)) {
          // Material Id does not exist. Create it.
          this.main[materialId] = {};
        }
        var matGroup = this.main[materialId];
        if (!(geomId in matGroup)) {
          matGroup[geomId] = {};
        }
        // Slot the node in.
        matGroup[geomId][node.id] = node;
      }
    },

    render: function(viewport, camera) {
      var setupMaterial = false;
      var geom = null;
      var gl = this.videoEngine.gl;
      var material;
      // Lol complicated code. Thanks Javascript for having sucky
      // data structures.
      gl.enable(gl.DEPTH_TEST);
      for (var materialId in this.main) {
        var geoms = this.main[materialId];
        for (var geomId in geoms) {
          var nodes = geoms[geomId];
          geom = null;
          for (var nodeId in nodes) {
            var node = nodes[nodeId];
            if (!setupMaterial) {
              material = node.geoms[geomId].material;
              material.bind(viewport, camera);
              setupMaterial = true;
            }
            //var material = node.geoms[geomId].material;
            //material.bind(viewport, camera);
            geom = node.geoms[geomId];
            break;
          }
          if (geom) material.render(geom, nodes);
        }
        if (setupMaterial) material.unbind();
        setupMaterial = false;
      }
      // TODO: A render queue for objects with transparency
    },

  });

  // ==================================================

  var Viewport = dcl(Instance, {
     
    declaredClass: "bb4.core.Viewport",

    constructor: function(args) {
      // A viewport provides a view of a SceneGraph
      if (!args) args = {};
      this.videoEngine = args.videoEngine || this.videoEngine || console.error("args.videoEngine");
      this.x = 0;
      this.y = 0;
      this.width = 640;
      this.height = 480;
      this.scene = args.scene || null;
      this.camera = args.camera || null;
    },

    setScene: function(scene, camera) {
      // Set scene to render with optional camera.
      // If no camera is provided, we will create our own at identity.
      // TODO: Create our own scene at identity!
      this.scene = scene || null;
      this.camera = camera || null;
      return this;
    },

    resizeFill: function(args) {
      // Resizes the viewport to fill the area
      var screenWidth = args.width || this.videoEngine.getWidth();
      var screenHeight = args.height || this.videoEngine.getHeight();
      var aspect = args.aspectRatio || null;
      // TODO: We assume that we anchor at the centre of the screen
      // TODO: Some padding settings (e.g. like I want a small viewport
      // at the side of the screen)
      if (aspect) {
        if (aspect > 1) {
          this.width = screenWidth;
          this.height = screenWidth / aspect;
        } else {
          this.width = screenHeight * aspect;
          this.height = screenHeight;
        }
      } else {
        this.width = screenWidth;
        this.height = screenHeight;
      }
      this.x = (screenWidth - this.width) / 2;
      this.y = (screenHeight - this.height) / 2;
      this.reshape();
      return this;
    },

    enableResizeFill: function(args) {
      // Attach a resize listener to videoEngine and call resizeFill on resize.
      var that = this;
      if (!args) args = {};
      this.resizeFill(args);
      this._resizefillid = this.videoEngine.on("resize", function() {
        that.resizeFill(args);
      });
      return this;
    },

    disableResizeFill: function() {
      if (this._resizefillid) this.videoEngine.removeListener(this._resizefillid);
      return this;
    },

    render: function() {
      var gl = this.videoEngine.gl,
        scene = this.scene,
        camera = this.camera;
      // Clear depth buffer! (Different projections use different depth buffer values)
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      if (scene && camera) {
        gl.viewport(this.x, this.y, this.width, this.height);
        camera.cameraRender(this, scene);
      }
      return this;
    },

    getWidth: function() {return this.width;},
    getHeight: function() {return this.height;},
    setWidth: function(x) {this.width = x;},
    setHeight: function(x) {this.height = x;},
    getAspect: function() {return this.width / this.height;},
  });

  var PerspectiveViewport = dcl(Viewport, {

    declaredClass: "bb4.core.PerspectiveViewport",

    constructor: function(args) {
      if (!args) args = {};
      var pMatrix = glm.mat4.create();
      //TODO: move Fov to camera
      this.pMatrix = mat4.create();
      this.reshape();
    },

    reshape: function() {
      mat4.perspective(this.pMatrix, Math.PI/4, this.getAspect() , 0.1, 100);
      return this;
    },
  });

  var OrthographicViewport = dcl(Viewport, {

    declaredClass: "bb4.core.OrthographicViewport",

    constructor: function(args) {
      if (!args) args = {};
      if (this.width > this.height) {
        var height = 2;
        var width = (this.width / this.height) * 2;
      } else {
        // let width be one unit
        var width = 2;
        var height = (this.height / this.width) * 2;
      }
      this.pMatrix = mat4.create();
      this.reshape();
    },

    reshape: function() {
      mat4.ortho(this.pMatrix, -width / 2, width / 2, -height / 2, height / 2, -1, 1);
      return this;
    },
  });

  // ====================================================
  // Input subsystem

  var Input = dcl(EventEmitter, {
    declaredClass: "bb4.core.Input",

    constructor: function(args) {
      if (!args) args = {};
      var videoEngine = this.videoEngine = args.videoEngine || this.videoEngine || console.error("args.videoEngine");
      var logicEngine = this.logicEngine = args.logicEngine || this.logicEngine || console.error("args.logicEngine");
      this.name = args.name || "Unknown";
      this.currentDown = this.down =  false; //true if magnitude > engine.sensitivity
      this.currentMag = this.mag = 0.0; //0.0 to 1.0
      this.downChanged = false;
      this.magChanged = false;
      var that = this;
      this._beforeStepListener = logicEngine.on("beforestep", function() {
        var downChanged = that.downChanged = that.currentDown != that.down ? true : false;
        var magChanged = that.magChanged = that.currentMag != that.mag ? true: false;
        that.down = that.currentDown;
        that.mag = that.currentMag;
        if (downChanged) {
          that.emit("downchange");
          if (that.down)
            that.emit("down");
          else
            that.emit("up");
        }
        if (magChanged) {
          that.emit("magchange");
        }
      });
    },

    mapKey: function(key) {
      if (this._mapDownListener) this.videoEngine.removeListener(this._mapDownListener);
      if (this._mapUpListener) this.videoEngine.removeListener(this._mapUpListener);
      var that = this;
      this._mapDownListener = this.videoEngine.on("keydown", function(e) {
        if (e.key == key) {
          that.currentDown = true;
          that.currentMag = 1.0;
        }
      });
      this._mapUpListener = this.videoEngine.on("keyup", function(e) {
        if (e.key == key) {
          that.currentDown = false;
          that.currentMag = 0.0;
        }
      });
    },
  });

  var Axis = dcl(EventEmitter, {
    declaredClass: "bb4.core.Axis",

    constructor: function(args) {
      if (!args) args = {};
      this.up = args.up || null;
      this.down = args.down || null;
      this.left = args.left || null;
      this.right = args.right || null;
      this.rad = args.rad || 0.0;
      this.mag = args.mag || 0;
      var that = this;
      this.__handler = function() {
        var x = (that.right.mag - that.left.mag);
        var y = (that.up.mag - that.down.mag);
        that.rad = Math.atan2(y, x);
        var mag = Math.sqrt(x*x + y*y);
        if (Math.abs(x) > Math.abs(y)) mag *= Math.abs(Math.cos(that.rad));
        else mag *= Math.abs(Math.sin(that.rad));
        that.mag = Math.min(1.0, Math.max(0.0, mag));
      }
      this._upListener = this.up.on("magchange", this.__handler);
      this._downListener = this.down.on("magchange", this.__handler);
      this._leftListener = this.left.on("magchange", this.__handler);
      this._rightListener = this.right.on("magchange", this.__handler);
    },

  });

  // ====================================================
  
  var Image = dcl(EventEmitter, {
    // Represents an Image. Engine.getImage(). Returns cached image
    // if available. Just like Data, the image might not have finished
    // loading. Hence, it emits onLoad events.

    declaredClass: "bb4.core.Image",

    isComplete: function() {return false;},
    getWidth: function() {return 0;},
    getHeight: function() {return 0;},
  });

  var baseExports = {
    vec2: vec2,
    vec3: vec3,
    quat: quat,
    mat4: mat4,
    mat3: mat3,
    Instance: Instance,
    EventEmitter: EventEmitter,
    Node: Node,
    FunctionQueue: FunctionQueue,
    SpatialNode: SpatialNode,
  };

  function copyClasses(dest, src) {
    for (var name in src) {
      if (/[A-Z]/.test(name[0]) && src[name].prototype)
        dest[name] = src[name];
    }
  }
  function defClasses(t, obj) {
    for (var name in t) {
      if (/[A-Z]/.test(name[0]) && t[name].prototype) 
        t[name] = dcl(t[name], obj);
    }
  }

  // Logic Engines can be made children of each other to form manageable
  // logic groups. Logic Nodes can become members of Logic Engines
  // by listening for them.
  var LogicEngine = dcl([Node, EventEmitter], {
    declaredClass: "bb4.core.LogicEngine",

    constructor: function(args) {
      if (!args) args = {};
      this._lastStepTime = new Date().getTime(); //Local to reference time
      this.stepInterval = 1000 / 60; //Logic runs at 60fps
      defClasses(this, {logicEngine: this});
    },

    step: function() {
      // Logic Step
      this.emit("beforestep");
      this.emit("step");
      this.emit("afterstep");
      for (var nodeId in this.children) {
        // TODO: Assumes that stepInterval of children are the same
        this.children[nodeId].step();
      }
      this._lastStepTime += this.stepInterval;
    },

    update: function(time) {
      if (!time) time = new Date().getTime();
      while (this._lastStepTime + this.stepInterval < time)
        this.step();
    },
  });

  var _logicExports = {
    LogicEngine: LogicEngine,
  };
  var logicExports = Object.create(baseExports);
  for (var name in _logicExports)
    logicExports[name] = _logicExports[name];
  for (var name in logicExports)
    LogicEngine[name] = LogicEngine.prototype[name] = logicExports[name];

  var VideoEngine = dcl(EventEmitter, {

    declaredClass: "bb4.core.VideoEngine",

    constructor: function(args) {
      if (!args) args = {};
      this.viewports = [];
      this.width = args.width || 640; // Initial width of window
      this.height = args.height || 480; // Initial height of window
      var logicEngine = this.logicEngine = args.logicEngine || new this.LogicEngine();
      this.conductor = args.conductor || null;
      copyClasses(this, logicEngine);
      defClasses(this, {logicEngine: logicEngine, videoEngine: this});
    },

    addViewport: function(viewport) {
      // Add a viewport to the set of viewports. 
      this.viewports.push(viewport);
    },

    fullscreen: function() {
      // Not implemented
      // TODO: Send fullscreen failure event immediately
    },

    render: function() {
      // Renders the scene graph
      var gl = this.gl,
        viewports = this.viewports;
      gl.viewport(0, 0, this.width, this.height);
      // Consider not even clearing the color buffer at all (glClear is slow)
      //gl.clear(gl.COLOR_BUFFER_BIT);
      for (var i = 0; i < viewports.length; ++i) 
        viewports[i].render();
    },

    // TODO: Should getImage be here????
    getImage: function(src) {
      // Returns Image
      return new Image(src);
    },
  });

  var _videoExports = {
    Texture: Texture,
    Texture2: Texture2,
    TextureCube: TextureCube,
    Shader: Shader,
    Bone: Bone,
    Material: Material,
    FixedMaterial: FixedMaterial,
    ProgramMaterial: ProgramMaterial,
    FixedProgramMaterial: FixedProgramMaterial,
    SceneNode: SceneNode,
    Geom: Geom,
    Camera: Camera,
    SceneManager: SceneManager,
    Viewport: Viewport,
    PerspectiveViewport: PerspectiveViewport,
    OrthographicViewport: OrthographicViewport,
    Input: Input,
    Axis: Axis,
    Image: Image,
    VideoEngine: VideoEngine,
  };
  var videoExports = Object.create(logicExports);
  for (var name in _videoExports)
    videoExports[name] = _videoExports[name];
  for (var name in videoExports)
    VideoEngine[name] = VideoEngine.prototype[name] = videoExports[name];

  // The conductor manages and coordinates the running of all of the different engine types
  // CONDUCTOR is the up-and-running tool of bb4 designed for rapid prototyping.
  var Conductor = dcl(EventEmitter, {

    declaredClass: "bb4.core.Conductor",

    constructor: function(args) {
      if (!args) args = {};
      var logicEngine = this.logicEngine = args.logicEngine || new this.LogicEngine({conductor: this});
      var videoEngine = this.videoEngine = args.videoEngine || new this.VideoEngine({conductor: this, logicEngine: logicEngine});
      copyClasses(this, logicEngine);
      copyClasses(this, videoEngine);
      defClasses(this, {logicEngine: logicEngine, videoEngine: videoEngine, conductor: this});
      var scene = this.scene = new videoEngine.SceneManager({videoEngine: videoEngine, logicEngine: logicEngine});
      var camera = this.camera = new videoEngine.Camera({videoEngine: videoEngine, logicEngine: logicEngine});
      var viewport = this.viewport = new videoEngine.PerspectiveViewport({videoEngine: videoEngine, logicEngine: logicEngine, scene: scene, camera: camera}).enableResizeFill();
      videoEngine.addViewport(viewport);

      var that = this;
      var cback = function(e, target, callbackId, event) {
        that.emit(event, e, target);
      };
      videoEngine.on("*", cback);
      logicEngine.on("*", cback);
    },

    render: function() {
      this.videoEngine.render();
    },

    update: function(time) {
      this.logicEngine.update(time);
      this.render();
    },

    play: function() {
      throw "Not implemented";
    },

    pause: function() {
      throw "Not implemented";
    },
  });

  var _conductorExports = {
    Conductor: Conductor,
  };
  var conductorExports = Object.create(logicExports);
  for (var name in videoExports)
    conductorExports[name] = videoExports[name];
  for (var name in _conductorExports)
    conductorExports[name] = _conductorExports[name];
  for (var name in conductorExports)
    Conductor[name] = Conductor.prototype[name] = conductorExports[name];

  return Conductor;
});
// vim: set expandtab tabstop=2 shiftwidth=2:
