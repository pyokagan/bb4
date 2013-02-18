/* BB4 loader. Selects the right platform */
"use strict";
(function(factory) {
    if (typeof define != "undefined") {
        define(["./dom"], factory);
    } else if (typeof module != "undefined") {
        module.exports = factory(require("./node"));
    } else {
        bb4 = factory(bb4);
    }
})(function(plat) {
    return plat;
});
