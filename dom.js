/* DOM Platform implementation */
"use strict";
(function(factory) {
  if (typeof define != "undefined") {
    define(["./core", "dcl", "./domReady!"], factory);
  } else if (typeof module != "undefined") {
    module.exports = factory(require("./core"), require("dcl"));
  } else { 
    // TODO: DO what?
  }
})(function(core, dcl) {

  // This can be removed when all supported browsers support e.key
  var keyCodeToKey =  {
    "3": "Cancel", //VK_CANCEL
    "6": "Help", //VK_HELP
    "8": "Unidentified", //VK_BACK_SPACE
    "9": "Tab", //VK_TAB
    "12": "Clear", //VK_CLEAR
    "13": "Enter", //VK_RETURN
    "14": "Unidentified", //VK_ENTER
    "16": "Shift", //VK_SHIFT
    "17": "Control", //VK_CONTROL
    "18": "Unidentified", //VK_ALT
    "19": "Pause", //VK_PAUSE
    "20": "Unidentified", //VK_CAPS_LOCK
    "21": "Unidentified", //VK_KANA // VK_HANGUL
    "22": "Unidentified", //VK_EISU
    "23": "JunjaMode", //VK_JUNJA
    "24": "HanjaMode", //VK_FINAL
    "25": "Unidentified", //VK_HANJA // VK_KANJI
    "27": "Esc", //VK_ESCAPE
    "28": "Convert", //VK_CONVERT
    "29": "Nonconvert", //VK_NONCONVERT
    "30": "Accept", //VK_ACCEPT
    "31": "ModeChange", //VK_MODECHANGE
    "32": "Spacebar", //VK_SPACE
    "33": "Unidentified", //VK_PAGE_UP
    "34": "Unidentified", //VK_PAGE_DOWN
    "35": "End", //VK_END
    "36": "Home", //VK_HOME
    "37": "Left", //VK_LEFT
    "38": "Up", //VK_UP
    "39": "Right", //VK_RIGHT
    "40": "Down", //VK_DOWN
    "41": "Select", //VK_SELECT
    "42": "Unidentified", //VK_PRINT
    "43": "Execute", //VK_EXECUTE
    "44": "Unidentified", //VK_PRINTSCREEN
    "45": "Insert", //VK_INSERT
    "46": "Del", //VK_DELETE
    "48": "0", //VK_0
    "49": "1", //VK_1
    "50": "2", //VK_2
    "51": "3", //VK_3
    "52": "4", //VK_4
    "53": "5", //VK_5
    "54": "6", //VK_6
    "55": "7", //VK_7
    "56": "8", //VK_8
    "57": "8", //VK_9
    "58": ":", //VK_COLON
    "59": ";", //VK_SEMICOLON
    "60": "Unidentified", //VK_LESS_THAN
    "61": "Unidentified", //VK_EQUALS
    "62": "Unidentified", //VK_GREATER_THAN
    "63": "Unidentified", //VK_QUESTION_MARK
    "64": "Unidentified", //VK_AT
    "65": "a", //VK_A
    "66": "b", //VK_B
    "67": "c", //VK_C
    "68": "d", //VK_D
    "69": "e", //VK_E
    "70": "f", //VK_F
    "71": "g", //VK_G
    "72": "h", //VK_H
    "73": "i", //VK_I
    "74": "j", //VK_J
    "75": "k", //VK_K
    "76": "l", //VK_L
    "77": "m", //VK_M
    "78": "n", //VK_N
    "79": "o", //VK_O
    "80": "p", //VK_P
    "81": "q", //VK_Q
    "82": "r", //VK_R
    "83": "s", //VK_S
    "84": "t", //VK_T
    "85": "u", //VK_U
    "86": "v", //VK_V
    "87": "w", //VK_W
    "88": "x", //VK_X
    "89": "y", //VK_Y
    "90": "z", //VK_Z
    "91": "Unidentified", //VK_WIN
    "93": "Unidentified", //VK_CONTEXT_MENU
    "95": "Unidentified", //VK_SLEEP
    "96": "Unidentified", //VK_NUMPAD0
    "97": "Unidentified", //VK_NUMPAD1
    "98": "Unidentified", //VK_NUMPAD2
    "99": "Unidentified", //VK_NUMPAD3
    "100": "Unidentified", //VK_NUMPAD4
    "101": "Unidentified", //VK_NUMPAD5
    "102": "Unidentified", //VK_NUMPAD6
    "103": "Unidentified", //VK_NUMPAD7
    "104": "Unidentified", //VK_NUMPAD8
    "105": "Unidentified", //VK_NUMPAD9
    "106": "Multiply", //VK_MULTIPLY
    "107": "Add", //VK_ADD
    "108": "Separator", //VK_SEPARATOR
    "109": "Subtract", //VK_SUBTRACT
    "110": "Decimal", //VK_DECIMAL
    "111": "Divide", //VK_DIVIDE
    "112": "F1", //VK_F1
    "113": "F2", //VK_F2
    "114": "F3", //VK_F3
    "115": "F4", //VK_F4
    "116": "F5", //VK_F5
    "117": "F6", //VK_F6
    "118": "F7", //VK_F7
    "119": "F8", //VK_F8
    "120": "F9", //VK_F9
    "121": "F10", //VK_F10
    "122": "F11", //VK_F11
    "123": "F12", //VK_F12
    "124": "F13", //VK_F13
    "125": "F14", //VK_F14
    "126": "F15", //VK_F15
    "127": "F16", //VK_F16
    "128": "F17", //VK_F17
    "129": "F18", //VK_F18
    "130": "F19", //VK_F19
    "131": "F20", //VK_F20
    "132": "F21", //VK_F21
    "133": "F22", //VK_F22
    "134": "F23", //VK_F23
    "135": "F24", //VK_F24
    "144": "Unidentified", //VK_NUM_LOCK
    "145": "Unidentified", //VK_SCROLL_LOCK
    "160": "Unidentified", //VK_CIRCUMFLEX
    "161": "Unidentified", //VK_EXCLAMATION
    "162": "Unidentified", //VK_DOUBLE_QUOTE
    "163": "Unidentified", //VK_HASH
    "164": "Unidentified", //VK_DOLLAR
    "165": "Unidentified", //VK_PERCENT
    "166": "Unidentified", //VK_AMPERSAND
    "167": "Unidentified", //VK_UNDERSCORE
    "168": "Unidentified", //VK_OPEN_PAREN
    "169": "Unidentified", //VK_CLOSE_PAREN
    "170": "Unidentified", //VK_ASTERISK
    "171": "Unidentified", //VK_PLUS
    "172": "Unidentified", //VK_PIPE
    "173": "Unidentified", //VK_HYPHEN_MINUS
    "174": "Unidentified", //VK_OPEN_CURLY_BRACKET
    "175": "Unidentified", //VK_CLOSE_CURLY_BRACKET
    "176": "Unidentified", //VK_TILDE
    "188": "Unidentified", //VK_COMMA
    "190": "Unidentified", //VK_PERIOD
    "191": "Unidentified", //VK_SLASH
    "192": "Unidentified", //VK_BACK_QUOTE
    "219": "Unidentified", //VK_OPEN_BRACKET
    "220": "Unidentified", //VK_BACK_SLASH
    "221": "Unidentified", //VK_CLOSE_BRACKET
    "222": "Unidentified", //VK_QUOTE
    "224": "Unidentified", //VK_META
    "225": "Unidentified", //VK_ALTGR
  };

  var requestAnimationFrame = window.requestAnimationFrame || 
                              window.webkitRequestAnimationFrame ||
                              window.mozRequestAnimationFrame ||
                              window.oRequestAnimationFrame ||
                              function(c) {
                                window.setTimeout(function() {
                                  c(new Date().getTime());},
                                  60);
                              };

  function getGlContext(canvas) {
    var context;
    try {
      context = canvas.getContext("webgl", {alpha: false});
      if (context) { return context; }
    } catch(ex) {}
    try {
      context = canvas.getContext("experimental-webgl", {alpha: false});
      if (context) { return context; }
    } catch(ex) {}
    return null;
  }

  function keyFromEvent(e) {
    if (e.key) return e.key;
    else if (e.char) return e.char;
    else if (e.charCode) return String.fromCharCode(e.charCode);
    else {
      // Attempt to convert keyCode into key using a lookup table
      // keyCode in this case is the virtual key code
      var keyCode = e.keyCode || e.which;
      var key = keyCodeToKey[keyCode];
      return typeof key !== "undefined" ? key : "Unidentified";
    }
  }

  function keyboardEventPreventDefaultAction(e) {
    if (e.stopPropagation) e.stopPropagation();
    else e.cancelBubble = true;
    if (e.preventDefault) e.preventDefault();
    else e.returnValue = false;
  }


  var Image = dcl(core.EventEmitter, {
    declaredClass: "bb4.dom.Image",

    constructor: function(src) {
      var that = this;
      var img = this._img = document.createElement("img");
      img.addEventListener("load", function() {
        that.emit("load");
      });
      img.src = src;
    },

    isComplete: function() {return this._img.complete;},
    getWidth: function() {return this._img.naturalWidth;},
    getHeight: function() {return this._img.naturalHeight;},
  });

  var VideoEngine = dcl(core.VideoEngine, {
    declaredClass: "bb4.dom.VideoEngine",

    FixedMaterial: core.VideoEngine.FixedProgramMaterial,

    constructor: function(args) {
      if (!args) args = {};
      var that = this;
      var canvas = this._canvas = document.createElement("canvas");
      document.body.appendChild(canvas);
      var gl = this.gl = getGlContext(canvas);
      if (!gl) {
        alert("WebGL not supported");
        return null;
      }
      canvas.style.position = "absolute";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      this.glEnums = {};
      for (var propertyName in gl) {
        if (typeof gl[propertyName] == "number") 
          this.glEnums[gl[propertyName]] = propertyName;
      }
      var texImage2D = gl.texImage2D;
      gl.texImage2D = function(target, level, internalformat, format, type, image) {
        if (typeof image == "object") {
          return texImage2D.call(gl, target, level, internalformat, format, type, image._img);
        } else {
          return texImage2D.apply(gl, arguments);
        }
      }
      var enable = gl.enable;
      gl.enable = function(x) {
        if (x == gl.TEXTURE_2D || x == gl.TEXTURE_CUBE_MAP)
          return;
        enable.apply(gl, arguments);
      }
      var disable = gl.disable;
      gl.disable = function(x) {
        if (x == gl.TEXTURE_2D || x == gl.TEXTURE_CUBE_MAP)
          return;
        disable.apply(gl, arguments);
      }
      // Resize handler
      window.addEventListener("resize", function(e) {
        that._canvas.width = that._canvas.offsetWidth;
        that._canvas.height = that._canvas.offsetHeight;
        that.emit("resize");
      }, false);
      // Disable context menu
      window.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        return false;
      }, false);
      // Handle keyboard events
      document.addEventListener("keydown", function(e) {
        var key = keyFromEvent(e);
        keyboardEventPreventDefaultAction(e);
        var ev = {key: key};
        that.emit("keydown", ev);
        return false;
      });
      document.addEventListener("keyup", function(e) {
        var key = keyFromEvent(e);
        keyboardEventPreventDefaultAction(e);
        var ev = {key: key};
        that.emit("keyup", ev);
        return false;
      });
    },

    getImage: function(src) {
      var y = new Image(src);
      return y;
    },

    getWidth: function() {return this._canvas.width;},
    getHeight: function() {return this._canvas.height;}
  });


  var Conductor = dcl(core.Conductor, {
    declaredClass: "bb4.dom.Conductor",

    VideoEngine: VideoEngine,

    play: function() {
      var that = this, canvas = this._canvas;
      var fps = 0, frameCount = 0, lastFpsTime = new Date().getTime();
      function update(t) {
        if (t - lastFpsTime >= 1000) {
          fps = frameCount / (t - lastFpsTime) * 1000;
          frameCount = 0;
          lastFpsTime = t;
          console.log("FPS: " + fps);
        }
        requestAnimationFrame(update, canvas);
        that.update(t);
        frameCount += 1;
      }
      requestAnimationFrame(update, canvas);
    },
  });

  for (var exportName in core.Conductor) 
    Conductor[exportName] = core.Conductor[exportName];
  Conductor.Conductor = Conductor;
  Conductor.VideoEngine = VideoEngine;
  Conductor.Image = Image;
  Conductor.FixedMaterial = core.FixedProgramMaterial;

  return Conductor;
});
// vim: set expandtab tabstop=2 shiftwidth=2:
