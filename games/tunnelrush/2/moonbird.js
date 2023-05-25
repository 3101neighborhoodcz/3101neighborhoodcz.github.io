var Module = typeof Module !== "undefined" ? Module : {};
var moduleOverrides = {};
var key;
for (key in Module) {
    if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key]
    }
}
var arguments_ = [];
var thisProgram = "./this.program";
var quit_ = function(status, toThrow) {
    throw toThrow
};
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === "object";
ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
var scriptDirectory = "";
function locateFile(path) {
    if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory)
    }
    return scriptDirectory + path
}
var read_, readAsync, readBinary, setWindowTitle;
var nodeFS;
var nodePath;
if (ENVIRONMENT_IS_NODE) {
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = require("path").dirname(scriptDirectory) + "/"
    } else {
        scriptDirectory = __dirname + "/"
    }
    read_ = function shell_read(filename, binary) {
        if (!nodeFS)
            nodeFS = require("fs");
        if (!nodePath)
            nodePath = require("path");
        filename = nodePath["normalize"](filename);
        return nodeFS["readFileSync"](filename, binary ? null : "utf8")
    }
    ;
    readBinary = function readBinary(filename) {
        var ret = read_(filename, true);
        if (!ret.buffer) {
            ret = new Uint8Array(ret)
        }
        assert(ret.buffer);
        return ret
    }
    ;
    if (process["argv"].length > 1) {
        thisProgram = process["argv"][1].replace(/\\/g, "/")
    }
    arguments_ = process["argv"].slice(2);
    if (typeof module !== "undefined") {
        module["exports"] = Module
    }
    process["on"]("uncaughtException", function(ex) {
        if (!(ex instanceof ExitStatus)) {
            throw ex
        }
    });
    process["on"]("unhandledRejection", abort);
    quit_ = function(status) {
        process["exit"](status)
    }
    ;
    Module["inspect"] = function() {
        return "[Emscripten Module object]"
    }
} else if (ENVIRONMENT_IS_SHELL) {
    if (typeof read != "undefined") {
        read_ = function shell_read(f) {
            return read(f)
        }
    }
    readBinary = function readBinary(f) {
        var data;
        if (typeof readbuffer === "function") {
            return new Uint8Array(readbuffer(f))
        }
        data = read(f, "binary");
        assert(typeof data === "object");
        return data
    }
    ;
    if (typeof scriptArgs != "undefined") {
        arguments_ = scriptArgs
    } else if (typeof arguments != "undefined") {
        arguments_ = arguments
    }
    if (typeof quit === "function") {
        quit_ = function(status) {
            quit(status)
        }
    }
    if (typeof print !== "undefined") {
        if (typeof console === "undefined")
            console = {};
        console.log = print;
        console.warn = console.error = typeof printErr !== "undefined" ? printErr : print
    }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href
    } else if (document.currentScript) {
        scriptDirectory = document.currentScript.src
    }
    if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
    } else {
        scriptDirectory = ""
    }
    {
        read_ = function shell_read(url) {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, false);
            xhr.send(null);
            return xhr.responseText
        }
        ;
        if (ENVIRONMENT_IS_WORKER) {
            readBinary = function readBinary(url) {
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response)
            }
        }
        readAsync = function readAsync(url, onload, onerror) {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function xhr_onload() {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return
                }
                onerror()
            }
            ;
            xhr.onerror = onerror;
            xhr.send(null)
        }
    }
    setWindowTitle = function(title) {
        document.title = title
    }
} else {}
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.warn.bind(console);
for (key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key]
    }
}
moduleOverrides = null;
if (Module["arguments"])
    arguments_ = Module["arguments"];
if (Module["thisProgram"])
    thisProgram = Module["thisProgram"];
if (Module["quit"])
    quit_ = Module["quit"];
var STACK_ALIGN = 16;
function warnOnce(text) {
    if (!warnOnce.shown)
        warnOnce.shown = {};
    if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        err(text)
    }
}
function convertJsFunctionToWasm(func, sig) {
    if (typeof WebAssembly.Function === "function") {
        var typeNames = {
            "i": "i32",
            "j": "i64",
            "f": "f32",
            "d": "f64"
        };
        var type = {
            parameters: [],
            results: sig[0] == "v" ? [] : [typeNames[sig[0]]]
        };
        for (var i = 1; i < sig.length; ++i) {
            type.parameters.push(typeNames[sig[i]])
        }
        return new WebAssembly.Function(type,func)
    }
    var typeSection = [1, 0, 1, 96];
    var sigRet = sig.slice(0, 1);
    var sigParam = sig.slice(1);
    var typeCodes = {
        "i": 127,
        "j": 126,
        "f": 125,
        "d": 124
    };
    typeSection.push(sigParam.length);
    for (var i = 0; i < sigParam.length; ++i) {
        typeSection.push(typeCodes[sigParam[i]])
    }
    if (sigRet == "v") {
        typeSection.push(0)
    } else {
        typeSection = typeSection.concat([1, typeCodes[sigRet]])
    }
    typeSection[1] = typeSection.length - 2;
    var bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0].concat(typeSection, [2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0]));
    var module = new WebAssembly.Module(bytes);
    var instance = new WebAssembly.Instance(module,{
        "e": {
            "f": func
        }
    });
    var wrappedFunc = instance.exports["f"];
    return wrappedFunc
}
var freeTableIndexes = [];
var functionsInTableMap;
function addFunctionWasm(func, sig) {
    var table = wasmTable;
    if (!functionsInTableMap) {
        functionsInTableMap = new WeakMap;
        for (var i = 0; i < table.length; i++) {
            var item = table.get(i);
            if (item) {
                functionsInTableMap.set(item, i)
            }
        }
    }
    if (functionsInTableMap.has(func)) {
        return functionsInTableMap.get(func)
    }
    var ret;
    if (freeTableIndexes.length) {
        ret = freeTableIndexes.pop()
    } else {
        ret = table.length;
        try {
            table.grow(1)
        } catch (err) {
            if (!(err instanceof RangeError)) {
                throw err
            }
            throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH."
        }
    }
    try {
        table.set(ret, func)
    } catch (err) {
        if (!(err instanceof TypeError)) {
            throw err
        }
        var wrapped = convertJsFunctionToWasm(func, sig);
        table.set(ret, wrapped)
    }
    functionsInTableMap.set(func, ret);
    return ret
}
function removeFunctionWasm(index) {
    functionsInTableMap.delete(wasmTable.get(index));
    freeTableIndexes.push(index)
}
var tempRet0 = 0;
var setTempRet0 = function(value) {
    tempRet0 = value
};
var wasmBinary;
if (Module["wasmBinary"])
    wasmBinary = Module["wasmBinary"];
var noExitRuntime;
if (Module["noExitRuntime"])
    noExitRuntime = Module["noExitRuntime"];
if (typeof WebAssembly !== "object") {
    abort("no native wasm support detected")
}
var wasmMemory;
var wasmTable;
var ABORT = false;
var EXITSTATUS = 0;
function assert(condition, text) {
    if (!condition) {
        abort("Assertion failed: " + text)
    }
}
function getCFunc(ident) {
    var func = Module["_" + ident];
    assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
    return func
}
function ccall(ident, returnType, argTypes, args, opts) {
    var toC = {
        "string": function(str) {
            var ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
                var len = (str.length << 2) + 1;
                ret = stackAlloc(len);
                stringToUTF8(str, ret, len)
            }
            return ret
        },
        "array": function(arr) {
            var ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret
        }
    };
    function convertReturnValue(ret) {
        if (returnType === "string")
            return UTF8ToString(ret);
        if (returnType === "boolean")
            return Boolean(ret);
        return ret
    }
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
        for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
                if (stack === 0)
                    stack = stackSave();
                cArgs[i] = converter(args[i])
            } else {
                cArgs[i] = args[i]
            }
        }
    }
    var ret = func.apply(null, cArgs);
    ret = convertReturnValue(ret);
    if (stack !== 0)
        stackRestore(stack);
    return ret
}
function cwrap(ident, returnType, argTypes, opts) {
    argTypes = argTypes || [];
    var numericArgs = argTypes.every(function(type) {
        return type === "number"
    });
    var numericRet = returnType !== "string";
    if (numericRet && numericArgs && !opts) {
        return getCFunc(ident)
    }
    return function() {
        return ccall(ident, returnType, argTypes, arguments, opts)
    }
}
var ALLOC_STACK = 1;
var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (heap[endPtr] && !(endPtr >= endIdx))
        ++endPtr;
    if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(heap.subarray(idx, endPtr))
    } else {
        var str = "";
        while (idx < endPtr) {
            var u0 = heap[idx++];
            if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue
            }
            var u1 = heap[idx++] & 63;
            if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue
            }
            var u2 = heap[idx++] & 63;
            if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2
            } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63
            }
            if (u0 < 65536) {
                str += String.fromCharCode(u0)
            } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
            }
        }
    }
    return str
}
function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
}
function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0))
        return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx)
                break;
            heap[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx)
                break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx)
                break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx)
                break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}
function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343)
            u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127)
            ++len;
        else if (u <= 2047)
            len += 2;
        else if (u <= 65535)
            len += 3;
        else
            len += 4
    }
    return len
}
var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
function UTF16ToString(ptr, maxBytesToRead) {
    var endPtr = ptr;
    var idx = endPtr >> 1;
    var maxIdx = idx + maxBytesToRead / 2;
    while (!(idx >= maxIdx) && HEAPU16[idx])
        ++idx;
    endPtr = idx << 1;
    if (endPtr - ptr > 32 && UTF16Decoder) {
        return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr))
    } else {
        var i = 0;
        var str = "";
        while (1) {
            var codeUnit = HEAP16[ptr + i * 2 >> 1];
            if (codeUnit == 0 || i == maxBytesToRead / 2)
                return str;
            ++i;
            str += String.fromCharCode(codeUnit)
        }
    }
}
function stringToUTF16(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647
    }
    if (maxBytesToWrite < 2)
        return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
    for (var i = 0; i < numCharsToWrite; ++i) {
        var codeUnit = str.charCodeAt(i);
        HEAP16[outPtr >> 1] = codeUnit;
        outPtr += 2
    }
    HEAP16[outPtr >> 1] = 0;
    return outPtr - startPtr
}
function lengthBytesUTF16(str) {
    return str.length * 2
}
function UTF32ToString(ptr, maxBytesToRead) {
    var i = 0;
    var str = "";
    while (!(i >= maxBytesToRead / 4)) {
        var utf32 = HEAP32[ptr + i * 4 >> 2];
        if (utf32 == 0)
            break;
        ++i;
        if (utf32 >= 65536) {
            var ch = utf32 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
        } else {
            str += String.fromCharCode(utf32)
        }
    }
    return str
}
function stringToUTF32(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647
    }
    if (maxBytesToWrite < 4)
        return 0;
    var startPtr = outPtr;
    var endPtr = startPtr + maxBytesToWrite - 4;
    for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343) {
            var trailSurrogate = str.charCodeAt(++i);
            codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023
        }
        HEAP32[outPtr >> 2] = codeUnit;
        outPtr += 4;
        if (outPtr + 4 > endPtr)
            break
    }
    HEAP32[outPtr >> 2] = 0;
    return outPtr - startPtr
}
function lengthBytesUTF32(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343)
            ++i;
        len += 4
    }
    return len
}
function allocateUTF8OnStack(str) {
    var size = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(size);
    stringToUTF8Array(str, HEAP8, ret, size);
    return ret
}
function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer)
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
        HEAP8[buffer++ >> 0] = str.charCodeAt(i)
    }
    if (!dontAddNull)
        HEAP8[buffer >> 0] = 0
}
var WASM_PAGE_SIZE = 65536;
function alignUp(x, multiple) {
    if (x % multiple > 0) {
        x += multiple - x % multiple
    }
    return x
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateGlobalBufferAndViews(buf) {
    buffer = buf;
    Module["HEAP8"] = HEAP8 = new Int8Array(buf);
    Module["HEAP16"] = HEAP16 = new Int16Array(buf);
    Module["HEAP32"] = HEAP32 = new Int32Array(buf);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buf)
}
var STACK_BASE = 14256336;
var INITIAL_INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;
if (Module["wasmMemory"]) {
    wasmMemory = Module["wasmMemory"]
} else {
    wasmMemory = new WebAssembly.Memory({
        "initial": INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
        "maximum": 2147483648 / WASM_PAGE_SIZE
    })
}
if (wasmMemory) {
    buffer = wasmMemory.buffer
}
INITIAL_INITIAL_MEMORY = buffer.byteLength;
updateGlobalBufferAndViews(buffer);
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
    if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
            Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPRERUN__)
}
function initRuntime() {
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__)
}
function preMain() {
    callRuntimeCallbacks(__ATMAIN__)
}
function exitRuntime() {
    runtimeExited = true
}
function postRun() {
    if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
            Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
}
function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
}
function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
}
var Math_abs = Math.abs;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_min = Math.min;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
}
function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
function abort(what) {
    if (Module["onAbort"]) {
        Module["onAbort"](what)
    }
    what += "";
    err(what);
    ABORT = true;
    EXITSTATUS = 1;
    what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
    var e = new WebAssembly.RuntimeError(what);
    throw e
}
function hasPrefix(str, prefix) {
    return String.prototype.startsWith ? str.startsWith(prefix) : str.indexOf(prefix) === 0
}
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
    return hasPrefix(filename, dataURIPrefix)
}
var fileURIPrefix = "file://";
function isFileURI(filename) {
    return hasPrefix(filename, fileURIPrefix)
}
var wasmBinaryFile = "moonbird.wasm";
if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile)
}
function getBinary() {
    try {
        if (wasmBinary) {
            return new Uint8Array(wasmBinary)
        }
        if (readBinary) {
            return readBinary(wasmBinaryFile)
        } else {
            throw "both async and sync fetching of the wasm failed"
        }
    } catch (err) {
        abort(err)
    }
}
function getBinaryPromise() {
    if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
        return fetch(wasmBinaryFile, {
            credentials: "same-origin"
        }).then(function(response) {
            if (!response["ok"]) {
                throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
            }
            return response["arrayBuffer"]()
        }).catch(function() {
            return getBinary()
        })
    }
    return Promise.resolve().then(getBinary)
}
function createWasm() {
    var info = {
        "env": asmLibraryArg,
        "wasi_snapshot_preview1": asmLibraryArg
    };
    function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module["asm"] = exports;
        wasmTable = Module["asm"]["__indirect_function_table"];
        removeRunDependency("wasm-instantiate")
    }
    addRunDependency("wasm-instantiate");
    function receiveInstantiatedSource(output) {
        receiveInstance(output["instance"])
    }
    function instantiateArrayBuffer(receiver) {
        return getBinaryPromise().then(function(binary) {
            return WebAssembly.instantiate(binary, info)
        }).then(receiver, function(reason) {
            err("failed to asynchronously prepare wasm: " + reason);
            abort(reason)
        })
    }
    function instantiateAsync() {
        if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && typeof fetch === "function") {
            fetch(wasmBinaryFile, {
                credentials: "same-origin"
            }).then(function(response) {
                var result = WebAssembly.instantiateStreaming(response, info);
                return result.then(receiveInstantiatedSource, function(reason) {
                    err("wasm streaming compile failed: " + reason);
                    err("falling back to ArrayBuffer instantiation");
                    return instantiateArrayBuffer(receiveInstantiatedSource)
                })
            })
        } else {
            return instantiateArrayBuffer(receiveInstantiatedSource)
        }
    }
    if (Module["instantiateWasm"]) {
        try {
            var exports = Module["instantiateWasm"](info, receiveInstance);
            return exports
        } catch (e) {
            err("Module.instantiateWasm callback failed with error: " + e);
            return false
        }
    }
    instantiateAsync();
    return {}
}
var tempDouble;
var tempI64;
function sapp_js_add_beforeunload_listener() {
    Module.sokol_beforeunload = function(event) {
        if (__sapp_html5_get_ask_leave_site() != 0) {
            event.preventDefault();
            event.returnValue = " "
        }
    }
    ;
    window.addEventListener("beforeunload", Module.sokol_beforeunload)
}
function sapp_js_add_clipboard_listener() {
    Module.sokol_paste = function(event) {
        var pasted_str = event.clipboardData.getData("text");
        ccall("_sapp_emsc_onpaste", "void", ["string"], [pasted_str])
    }
    ;
    window.addEventListener("paste", Module.sokol_paste)
}
function sapp_js_add_dragndrop_listeners(canvas_name_cstr) {
    Module.sokol_drop_files = [];
    var canvas_name = UTF8ToString(canvas_name_cstr);
    var canvas = document.getElementById(canvas_name);
    Module.sokol_dragenter = function(event) {
        event.stopPropagation();
        event.preventDefault()
    }
    ;
    Module.sokol_dragleave = function(event) {
        event.stopPropagation();
        event.preventDefault()
    }
    ;
    Module.sokol_dragover = function(event) {
        event.stopPropagation();
        event.preventDefault()
    }
    ;
    Module.sokol_drop = function(event) {
        event.stopPropagation();
        event.preventDefault();
        var files = event.dataTransfer.files;
        Module.sokol_dropped_files = files;
        __sapp_emsc_begin_drop(files.length);
        var i;
        for (i = 0; i < files.length; i++) {
            ccall("_sapp_emsc_drop", "void", ["number", "string"], [i, files[i].name])
        }
        __sapp_emsc_end_drop(event.clientX, event.clientY)
    }
    ;
    canvas.addEventListener("dragenter", Module.sokol_dragenter, false);
    canvas.addEventListener("dragleave", Module.sokol_dragleave, false);
    canvas.addEventListener("dragover", Module.sokol_dragover, false);
    canvas.addEventListener("drop", Module.sokol_drop, false)
}
function sapp_js_create_textfield() {
    var _sapp_inp = document.createElement("input");
    _sapp_inp.type = "text";
    _sapp_inp.id = "_sokol_app_input_element";
    _sapp_inp.autocapitalize = "none";
    _sapp_inp.addEventListener("focusout", function(_sapp_event) {
        __sapp_emsc_notify_keyboard_hidden()
    });
    document.body.append(_sapp_inp)
}
function sapp_js_dropped_file_size(index) {
    if (index < 0 || index >= Module.sokol_dropped_files.length) {
        return 0
    } else {
        return Module.sokol_dropped_files[index].size
    }
}
function sapp_js_exit_pointerlock() {
    if (document.exitPointerLock) {
        document.exitPointerLock()
    }
}
function sapp_js_fetch_dropped_file(index, callback, buf_ptr, buf_size, user_data) {
    var reader = new FileReader;
    reader.onload = function(loadEvent) {
        var content = loadEvent.target.result;
        if (content.byteLength > buf_size) {
            __sapp_emsc_invoke_fetch_cb(index, 0, 1, callback, 0, buf_ptr, buf_size, user_data)
        } else {
            HEAPU8.set(new Uint8Array(content), buf_ptr);
            __sapp_emsc_invoke_fetch_cb(index, 1, 0, callback, content.byteLength, buf_ptr, buf_size, user_data)
        }
    }
    ;
    reader.onerror = function() {
        __sapp_emsc_invoke_fetch_cb(index, 0, 2, callback, 0, buf_ptr, buf_size, user_data)
    }
    ;
    reader.readAsArrayBuffer(Module.sokol_dropped_files[index])
}
function sapp_js_focus_textfield() {
    document.getElementById("_sokol_app_input_element").focus()
}
function sapp_js_pointer_init(c_str_target) {
    var target_str = UTF8ToString(c_str_target);
    Module.sapp_emsc_target = document.getElementById(target_str);
    if (!Module.sapp_emsc_target) {
        console.log("sokol_app.h: invalid target:" + target_str)
    }
    if (!Module.sapp_emsc_target.requestPointerLock) {
        console.log("sokol_app.h: target doesn't support requestPointerLock:" + target_str)
    }
}
function sapp_js_remove_beforeunload_listener() {
    window.removeEventListener("beforeunload", Module.sokol_beforeunload)
}
function sapp_js_remove_clipboard_listener() {
    window.removeEventListener("paste", Module.sokol_paste)
}
function sapp_js_remove_dragndrop_listeners(canvas_name_cstr) {
    var canvas_name = UTF8ToString(canvas_name_cstr);
    var canvas = document.getElementById(canvas_name);
    canvas.removeEventListener("dragenter", Module.sokol_dragenter);
    canvas.removeEventListener("dragleave", Module.sokol_dragleave);
    canvas.removeEventListener("dragover", Module.sokol_dragover);
    canvas.removeEventListener("drop", Module.sokol_drop)
}
function sapp_js_request_pointerlock() {
    if (Module.sapp_emsc_target) {
        if (Module.sapp_emsc_target.requestPointerLock) {
            Module.sapp_emsc_target.requestPointerLock()
        }
    }
}
function sapp_js_unfocus_textfield() {
    document.getElementById("_sokol_app_input_element").blur()
}
function sapp_js_write_clipboard(c_str) {
    var str = UTF8ToString(c_str);
    var ta = document.createElement("textarea");
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("spellcheck", "false");
    ta.style.left = -100 + "px";
    ta.style.top = -100 + "px";
    ta.style.height = 1;
    ta.style.width = 1;
    ta.value = str;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta)
}
function saudio_js_buffer_frames() {
    if (Module._saudio_node) {
        return Module._saudio_node.bufferSize
    } else {
        return 0
    }
}
function saudio_js_init(sample_rate, num_channels, buffer_size) {
    Module._saudio_context = null;
    Module._saudio_node = null;
    if (typeof AudioContext !== "undefined") {
        Module._saudio_context = new AudioContext({
            sampleRate: sample_rate,
            latencyHint: "interactive"
        })
    } else if (typeof webkitAudioContext !== "undefined") {
        Module._saudio_context = new webkitAudioContext({
            sampleRate: sample_rate,
            latencyHint: "interactive"
        })
    } else {
        Module._saudio_context = null;
        console.log("sokol_audio.h: no WebAudio support")
    }
    if (Module._saudio_context) {
        console.log("sokol_audio.h: sample rate ", Module._saudio_context.sampleRate);
        Module._saudio_node = Module._saudio_context.createScriptProcessor(buffer_size, 0, num_channels);
        Module._saudio_node.onaudioprocess = function pump_audio(event) {
            var num_frames = event.outputBuffer.length;
            var ptr = __saudio_emsc_pull(num_frames);
            if (ptr) {
                var num_channels = event.outputBuffer.numberOfChannels;
                for (var chn = 0; chn < num_channels; chn++) {
                    var chan = event.outputBuffer.getChannelData(chn);
                    for (var i = 0; i < num_frames; i++) {
                        chan[i] = HEAPF32[(ptr >> 2) + (num_channels * i + chn)]
                    }
                }
            }
        }
        ;
        Module._saudio_node.connect(Module._saudio_context.destination);
        var resume_webaudio = function() {
            if (Module._saudio_context) {
                if (Module._saudio_context.state === "suspended") {
                    Module._saudio_context.resume()
                }
            }
        };
        document.addEventListener("click", resume_webaudio, {
            once: true
        });
        document.addEventListener("touchstart", resume_webaudio, {
            once: true
        });
        document.addEventListener("keydown", resume_webaudio, {
            once: true
        });
        return 1
    } else {
        return 0
    }
}
function saudio_js_sample_rate() {
    if (Module._saudio_context) {
        return Module._saudio_context.sampleRate
    } else {
        return 0
    }
}
function saudio_js_shutdown() {
    if (Module._saudio_context !== null) {
        if (Module._saudio_node) {
            Module._saudio_node.disconnect()
        }
        Module._saudio_context.close();
        Module._saudio_context = null;
        Module._saudio_node = null
    }
}
function sfetch_js_send_get_request(slot_id, path_cstr, offset, bytes_to_read, buf_ptr, buf_size) {
    var path_str = UTF8ToString(path_cstr);
    var req = new XMLHttpRequest;
    req.open("GET", path_str);
    req.responseType = "arraybuffer";
    var need_range_request = bytes_to_read > 0;
    if (need_range_request) {
        req.setRequestHeader("Range", "bytes=" + offset + "-" + (offset + bytes_to_read))
    }
    req.onreadystatechange = function() {
        if (this.readyState == this.DONE) {
            if (this.status == 206 || this.status == 200 && !need_range_request) {
                var u8_array = new Uint8Array(req.response);
                var content_fetched_size = u8_array.length;
                if (content_fetched_size <= buf_size) {
                    HEAPU8.set(u8_array, buf_ptr);
                    __sfetch_emsc_get_response(slot_id, bytes_to_read, content_fetched_size)
                } else {
                    __sfetch_emsc_failed_buffer_too_small(slot_id)
                }
            } else {
                __sfetch_emsc_failed_http_status(slot_id, this.status)
            }
        }
    }
    ;
    req.send()
}
function sfetch_js_send_head_request(slot_id, path_cstr) {
    var path_str = UTF8ToString(path_cstr);
    var req = new XMLHttpRequest;
    req.open("HEAD", path_str);
    req.onreadystatechange = function() {
        if (this.readyState == this.DONE) {
            if (this.status == 200) {
                var content_length = this.getResponseHeader("Content-Length");
                __sfetch_emsc_head_response(slot_id, content_length)
            } else {
                __sfetch_emsc_failed_http_status(slot_id, this.status)
            }
        }
    }
    ;
    req.send()
}
function stm_js_perfnow() {
    return performance.now()
}
function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == "function") {
            callback(Module);
            continue
        }
        var func = callback.func;
        if (typeof func === "number") {
            if (callback.arg === undefined) {
                wasmTable.get(func)()
            } else {
                wasmTable.get(func)(callback.arg)
            }
        } else {
            func(callback.arg === undefined ? null : callback.arg)
        }
    }
}
function demangle(func) {
    return func
}
function demangleAll(text) {
    var regex = /\b_Z[\w\d_]+/g;
    return text.replace(regex, function(x) {
        var y = demangle(x);
        return x === y ? x : y + " [" + x + "]"
    })
}
function dynCallLegacy(sig, ptr, args) {
    if (args && args.length) {
        return Module["dynCall_" + sig].apply(null, [ptr].concat(args))
    }
    return Module["dynCall_" + sig].call(null, ptr)
}
function dynCall(sig, ptr, args) {
    if (sig.indexOf("j") != -1) {
        return dynCallLegacy(sig, ptr, args)
    }
    return wasmTable.get(ptr).apply(null, args)
}
function jsStackTrace() {
    var error = new Error;
    if (!error.stack) {
        try {
            throw new Error
        } catch (e) {
            error = e
        }
        if (!error.stack) {
            return "(no stack trace available)"
        }
    }
    return error.stack.toString()
}
var structRegistrations = {};
function runDestructors(destructors) {
    while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr)
    }
}
function simpleReadValueFromPointer(pointer) {
    return this["fromWireType"](HEAPU32[pointer >> 2])
}
var awaitingDependencies = {};
var registeredTypes = {};
var typeDependencies = {};
var char_0 = 48;
var char_9 = 57;
function makeLegalFunctionName(name) {
    if (undefined === name) {
        return "_unknown"
    }
    name = name.replace(/[^a-zA-Z0-9_]/g, "$");
    var f = name.charCodeAt(0);
    if (f >= char_0 && f <= char_9) {
        return "_" + name
    } else {
        return name
    }
}
function createNamedFunction(name, body) {
    name = makeLegalFunctionName(name);
    return new Function("body","return function " + name + "() {\n" + '    "use strict";' + "    return body.apply(this, arguments);\n" + "};\n")(body)
}
function extendError(baseErrorType, errorName) {
    var errorClass = createNamedFunction(errorName, function(message) {
        this.name = errorName;
        this.message = message;
        var stack = new Error(message).stack;
        if (stack !== undefined) {
            this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "")
        }
    });
    errorClass.prototype = Object.create(baseErrorType.prototype);
    errorClass.prototype.constructor = errorClass;
    errorClass.prototype.toString = function() {
        if (this.message === undefined) {
            return this.name
        } else {
            return this.name + ": " + this.message
        }
    }
    ;
    return errorClass
}
var InternalError = undefined;
function throwInternalError(message) {
    throw new InternalError(message)
}
function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
    myTypes.forEach(function(type) {
        typeDependencies[type] = dependentTypes
    });
    function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);
        if (myTypeConverters.length !== myTypes.length) {
            throwInternalError("Mismatched type converter count")
        }
        for (var i = 0; i < myTypes.length; ++i) {
            registerType(myTypes[i], myTypeConverters[i])
        }
    }
    var typeConverters = new Array(dependentTypes.length);
    var unregisteredTypes = [];
    var registered = 0;
    dependentTypes.forEach(function(dt, i) {
        if (registeredTypes.hasOwnProperty(dt)) {
            typeConverters[i] = registeredTypes[dt]
        } else {
            unregisteredTypes.push(dt);
            if (!awaitingDependencies.hasOwnProperty(dt)) {
                awaitingDependencies[dt] = []
            }
            awaitingDependencies[dt].push(function() {
                typeConverters[i] = registeredTypes[dt];
                ++registered;
                if (registered === unregisteredTypes.length) {
                    onComplete(typeConverters)
                }
            })
        }
    });
    if (0 === unregisteredTypes.length) {
        onComplete(typeConverters)
    }
}
function __embind_finalize_value_object(structType) {
    var reg = structRegistrations[structType];
    delete structRegistrations[structType];
    var rawConstructor = reg.rawConstructor;
    var rawDestructor = reg.rawDestructor;
    var fieldRecords = reg.fields;
    var fieldTypes = fieldRecords.map(function(field) {
        return field.getterReturnType
    }).concat(fieldRecords.map(function(field) {
        return field.setterArgumentType
    }));
    whenDependentTypesAreResolved([structType], fieldTypes, function(fieldTypes) {
        var fields = {};
        fieldRecords.forEach(function(field, i) {
            var fieldName = field.fieldName;
            var getterReturnType = fieldTypes[i];
            var getter = field.getter;
            var getterContext = field.getterContext;
            var setterArgumentType = fieldTypes[i + fieldRecords.length];
            var setter = field.setter;
            var setterContext = field.setterContext;
            fields[fieldName] = {
                read: function(ptr) {
                    return getterReturnType["fromWireType"](getter(getterContext, ptr))
                },
                write: function(ptr, o) {
                    var destructors = [];
                    setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, o));
                    runDestructors(destructors)
                }
            }
        });
        return [{
            name: reg.name,
            "fromWireType": function(ptr) {
                var rv = {};
                for (var i in fields) {
                    rv[i] = fields[i].read(ptr)
                }
                rawDestructor(ptr);
                return rv
            },
            "toWireType": function(destructors, o) {
                for (var fieldName in fields) {
                    if (!(fieldName in o)) {
                        throw new TypeError('Missing field:  "' + fieldName + '"')
                    }
                }
                var ptr = rawConstructor();
                for (fieldName in fields) {
                    fields[fieldName].write(ptr, o[fieldName])
                }
                if (destructors !== null) {
                    destructors.push(rawDestructor, ptr)
                }
                return ptr
            },
            "argPackAdvance": 8,
            "readValueFromPointer": simpleReadValueFromPointer,
            destructorFunction: rawDestructor
        }]
    })
}
function getShiftFromSize(size) {
    switch (size) {
    case 1:
        return 0;
    case 2:
        return 1;
    case 4:
        return 2;
    case 8:
        return 3;
    default:
        throw new TypeError("Unknown type size: " + size)
    }
}
function embind_init_charCodes() {
    var codes = new Array(256);
    for (var i = 0; i < 256; ++i) {
        codes[i] = String.fromCharCode(i)
    }
    embind_charCodes = codes
}
var embind_charCodes = undefined;
function readLatin1String(ptr) {
    var ret = "";
    var c = ptr;
    while (HEAPU8[c]) {
        ret += embind_charCodes[HEAPU8[c++]]
    }
    return ret
}
var BindingError = undefined;
function throwBindingError(message) {
    throw new BindingError(message)
}
function registerType(rawType, registeredInstance, options) {
    options = options || {};
    if (!("argPackAdvance"in registeredInstance)) {
        throw new TypeError("registerType registeredInstance requires argPackAdvance")
    }
    var name = registeredInstance.name;
    if (!rawType) {
        throwBindingError('type "' + name + '" must have a positive integer typeid pointer')
    }
    if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
            return
        } else {
            throwBindingError("Cannot register type '" + name + "' twice")
        }
    }
    registeredTypes[rawType] = registeredInstance;
    delete typeDependencies[rawType];
    if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach(function(cb) {
            cb()
        })
    }
}
function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": function(wt) {
            return !!wt
        },
        "toWireType": function(destructors, o) {
            return o ? trueValue : falseValue
        },
        "argPackAdvance": 8,
        "readValueFromPointer": function(pointer) {
            var heap;
            if (size === 1) {
                heap = HEAP8
            } else if (size === 2) {
                heap = HEAP16
            } else if (size === 4) {
                heap = HEAP32
            } else {
                throw new TypeError("Unknown boolean type size: " + name)
            }
            return this["fromWireType"](heap[pointer >> shift])
        },
        destructorFunction: null
    })
}
var emval_free_list = [];
var emval_handle_array = [{}, {
    value: undefined
}, {
    value: null
}, {
    value: true
}, {
    value: false
}];
function __emval_decref(handle) {
    if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
        emval_handle_array[handle] = undefined;
        emval_free_list.push(handle)
    }
}
function count_emval_handles() {
    var count = 0;
    for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
            ++count
        }
    }
    return count
}
function get_first_emval() {
    for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
            return emval_handle_array[i]
        }
    }
    return null
}
function init_emval() {
    Module["count_emval_handles"] = count_emval_handles;
    Module["get_first_emval"] = get_first_emval
}
function __emval_register(value) {
    switch (value) {
    case undefined:
        {
            return 1
        }
    case null:
        {
            return 2
        }
    case true:
        {
            return 3
        }
    case false:
        {
            return 4
        }
    default:
        {
            var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
            emval_handle_array[handle] = {
                refcount: 1,
                value: value
            };
            return handle
        }
    }
}
function __embind_register_emval(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": function(handle) {
            var rv = emval_handle_array[handle].value;
            __emval_decref(handle);
            return rv
        },
        "toWireType": function(destructors, value) {
            return __emval_register(value)
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: null
    })
}
function ensureOverloadTable(proto, methodName, humanName) {
    if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName];
        proto[methodName] = function() {
            if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!")
            }
            return proto[methodName].overloadTable[arguments.length].apply(this, arguments)
        }
        ;
        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc
    }
}
function exposePublicSymbol(name, value, numArguments) {
    if (Module.hasOwnProperty(name)) {
        if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
            throwBindingError("Cannot register public name '" + name + "' twice")
        }
        ensureOverloadTable(Module, name, name);
        if (Module.hasOwnProperty(numArguments)) {
            throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!")
        }
        Module[name].overloadTable[numArguments] = value
    } else {
        Module[name] = value;
        if (undefined !== numArguments) {
            Module[name].numArguments = numArguments
        }
    }
}
function enumReadValueFromPointer(name, shift, signed) {
    switch (shift) {
    case 0:
        return function(pointer) {
            var heap = signed ? HEAP8 : HEAPU8;
            return this["fromWireType"](heap[pointer])
        }
        ;
    case 1:
        return function(pointer) {
            var heap = signed ? HEAP16 : HEAPU16;
            return this["fromWireType"](heap[pointer >> 1])
        }
        ;
    case 2:
        return function(pointer) {
            var heap = signed ? HEAP32 : HEAPU32;
            return this["fromWireType"](heap[pointer >> 2])
        }
        ;
    default:
        throw new TypeError("Unknown integer type: " + name)
    }
}
function __embind_register_enum(rawType, name, size, isSigned) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    function ctor() {}
    ctor.values = {};
    registerType(rawType, {
        name: name,
        constructor: ctor,
        "fromWireType": function(c) {
            return this.constructor.values[c]
        },
        "toWireType": function(destructors, c) {
            return c.value
        },
        "argPackAdvance": 8,
        "readValueFromPointer": enumReadValueFromPointer(name, shift, isSigned),
        destructorFunction: null
    });
    exposePublicSymbol(name, ctor)
}
function getTypeName(type) {
    var ptr = ___getTypeName(type);
    var rv = readLatin1String(ptr);
    _free(ptr);
    return rv
}
function requireRegisteredType(rawType, humanName) {
    var impl = registeredTypes[rawType];
    if (undefined === impl) {
        throwBindingError(humanName + " has unknown type " + getTypeName(rawType))
    }
    return impl
}
function __embind_register_enum_value(rawEnumType, name, enumValue) {
    var enumType = requireRegisteredType(rawEnumType, "enum");
    name = readLatin1String(name);
    var Enum = enumType.constructor;
    var Value = Object.create(enumType.constructor.prototype, {
        value: {
            value: enumValue
        },
        constructor: {
            value: createNamedFunction(enumType.name + "_" + name, function() {})
        }
    });
    Enum.values[enumValue] = Value;
    Enum[name] = Value
}
function _embind_repr(v) {
    if (v === null) {
        return "null"
    }
    var t = typeof v;
    if (t === "object" || t === "array" || t === "function") {
        return v.toString()
    } else {
        return "" + v
    }
}
function floatReadValueFromPointer(name, shift) {
    switch (shift) {
    case 2:
        return function(pointer) {
            return this["fromWireType"](HEAPF32[pointer >> 2])
        }
        ;
    case 3:
        return function(pointer) {
            return this["fromWireType"](HEAPF64[pointer >> 3])
        }
        ;
    default:
        throw new TypeError("Unknown float type: " + name)
    }
}
function __embind_register_float(rawType, name, size) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": function(value) {
            return value
        },
        "toWireType": function(destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
                throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
            }
            return value
        },
        "argPackAdvance": 8,
        "readValueFromPointer": floatReadValueFromPointer(name, shift),
        destructorFunction: null
    })
}
function new_(constructor, argumentList) {
    if (!(constructor instanceof Function)) {
        throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function")
    }
    var dummy = createNamedFunction(constructor.name || "unknownFunctionName", function() {});
    dummy.prototype = constructor.prototype;
    var obj = new dummy;
    var r = constructor.apply(obj, argumentList);
    return r instanceof Object ? r : obj
}
function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
    var argCount = argTypes.length;
    if (argCount < 2) {
        throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!")
    }
    var isClassMethodFunc = argTypes[1] !== null && classType !== null;
    var needsDestructorStack = false;
    for (var i = 1; i < argTypes.length; ++i) {
        if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
            needsDestructorStack = true;
            break
        }
    }
    var returns = argTypes[0].name !== "void";
    var argsList = "";
    var argsListWired = "";
    for (var i = 0; i < argCount - 2; ++i) {
        argsList += (i !== 0 ? ", " : "") + "arg" + i;
        argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired"
    }
    var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";
    if (needsDestructorStack) {
        invokerFnBody += "var destructors = [];\n"
    }
    var dtorStack = needsDestructorStack ? "destructors" : "null";
    var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
    var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
    if (isClassMethodFunc) {
        invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n"
    }
    for (var i = 0; i < argCount - 2; ++i) {
        invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
        args1.push("argType" + i);
        args2.push(argTypes[i + 2])
    }
    if (isClassMethodFunc) {
        argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired
    }
    invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
    if (needsDestructorStack) {
        invokerFnBody += "runDestructors(destructors);\n"
    } else {
        for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
            var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
            if (argTypes[i].destructorFunction !== null) {
                invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
                args1.push(paramName + "_dtor");
                args2.push(argTypes[i].destructorFunction)
            }
        }
    }
    if (returns) {
        invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n"
    } else {}
    invokerFnBody += "}\n";
    args1.push(invokerFnBody);
    var invokerFunction = new_(Function, args1).apply(null, args2);
    return invokerFunction
}
function heap32VectorToArray(count, firstElement) {
    var array = [];
    for (var i = 0; i < count; i++) {
        array.push(HEAP32[(firstElement >> 2) + i])
    }
    return array
}
function replacePublicSymbol(name, value, numArguments) {
    if (!Module.hasOwnProperty(name)) {
        throwInternalError("Replacing nonexistant public symbol")
    }
    if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
        Module[name].overloadTable[numArguments] = value
    } else {
        Module[name] = value;
        Module[name].argCount = numArguments
    }
}
function getDynCaller(sig, ptr) {
    assert(sig.indexOf("j") >= 0, "getDynCaller should only be called with i64 sigs");
    var argCache = [];
    return function() {
        argCache.length = arguments.length;
        for (var i = 0; i < arguments.length; i++) {
            argCache[i] = arguments[i]
        }
        return dynCall(sig, ptr, argCache)
    }
}
function embind__requireFunction(signature, rawFunction) {
    signature = readLatin1String(signature);
    function makeDynCaller() {
        if (signature.indexOf("j") != -1) {
            return getDynCaller(signature, rawFunction)
        }
        return wasmTable.get(rawFunction)
    }
    var fp = makeDynCaller();
    if (typeof fp !== "function") {
        throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction)
    }
    return fp
}
var UnboundTypeError = undefined;
function throwUnboundTypeError(message, types) {
    var unboundTypes = [];
    var seen = {};
    function visit(type) {
        if (seen[type]) {
            return
        }
        if (registeredTypes[type]) {
            return
        }
        if (typeDependencies[type]) {
            typeDependencies[type].forEach(visit);
            return
        }
        unboundTypes.push(type);
        seen[type] = true
    }
    types.forEach(visit);
    throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]))
}
function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
    var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    name = readLatin1String(name);
    rawInvoker = embind__requireFunction(signature, rawInvoker);
    exposePublicSymbol(name, function() {
        throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes)
    }, argCount - 1);
    whenDependentTypesAreResolved([], argTypes, function(argTypes) {
        var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
        replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
        return []
    })
}
function integerReadValueFromPointer(name, shift, signed) {
    switch (shift) {
    case 0:
        return signed ? function readS8FromPointer(pointer) {
            return HEAP8[pointer]
        }
        : function readU8FromPointer(pointer) {
            return HEAPU8[pointer]
        }
        ;
    case 1:
        return signed ? function readS16FromPointer(pointer) {
            return HEAP16[pointer >> 1]
        }
        : function readU16FromPointer(pointer) {
            return HEAPU16[pointer >> 1]
        }
        ;
    case 2:
        return signed ? function readS32FromPointer(pointer) {
            return HEAP32[pointer >> 2]
        }
        : function readU32FromPointer(pointer) {
            return HEAPU32[pointer >> 2]
        }
        ;
    default:
        throw new TypeError("Unknown integer type: " + name)
    }
}
function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
    name = readLatin1String(name);
    if (maxRange === -1) {
        maxRange = 4294967295
    }
    var shift = getShiftFromSize(size);
    var fromWireType = function(value) {
        return value
    };
    if (minRange === 0) {
        var bitshift = 32 - 8 * size;
        fromWireType = function(value) {
            return value << bitshift >>> bitshift
        }
    }
    var isUnsignedType = name.indexOf("unsigned") != -1;
    registerType(primitiveType, {
        name: name,
        "fromWireType": fromWireType,
        "toWireType": function(destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
                throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
            }
            if (value < minRange || value > maxRange) {
                throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!")
            }
            return isUnsignedType ? value >>> 0 : value | 0
        },
        "argPackAdvance": 8,
        "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
        destructorFunction: null
    })
}
function __embind_register_memory_view(rawType, dataTypeIndex, name) {
    var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
    var TA = typeMapping[dataTypeIndex];
    function decodeMemoryView(handle) {
        handle = handle >> 2;
        var heap = HEAPU32;
        var size = heap[handle];
        var data = heap[handle + 1];
        return new TA(buffer,data,size)
    }
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": decodeMemoryView,
        "argPackAdvance": 8,
        "readValueFromPointer": decodeMemoryView
    }, {
        ignoreDuplicateRegistrations: true
    })
}
function __embind_register_std_string(rawType, name) {
    name = readLatin1String(name);
    var stdStringIsUTF8 = name === "std::string";
    registerType(rawType, {
        name: name,
        "fromWireType": function(value) {
            var length = HEAPU32[value >> 2];
            var str;
            if (stdStringIsUTF8) {
                var decodeStartPtr = value + 4;
                for (var i = 0; i <= length; ++i) {
                    var currentBytePtr = value + 4 + i;
                    if (i == length || HEAPU8[currentBytePtr] == 0) {
                        var maxRead = currentBytePtr - decodeStartPtr;
                        var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                        if (str === undefined) {
                            str = stringSegment
                        } else {
                            str += String.fromCharCode(0);
                            str += stringSegment
                        }
                        decodeStartPtr = currentBytePtr + 1
                    }
                }
            } else {
                var a = new Array(length);
                for (var i = 0; i < length; ++i) {
                    a[i] = String.fromCharCode(HEAPU8[value + 4 + i])
                }
                str = a.join("")
            }
            _free(value);
            return str
        },
        "toWireType": function(destructors, value) {
            if (value instanceof ArrayBuffer) {
                value = new Uint8Array(value)
            }
            var getLength;
            var valueIsOfTypeString = typeof value === "string";
            if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                throwBindingError("Cannot pass non-string to std::string")
            }
            if (stdStringIsUTF8 && valueIsOfTypeString) {
                getLength = function() {
                    return lengthBytesUTF8(value)
                }
            } else {
                getLength = function() {
                    return value.length
                }
            }
            var length = getLength();
            var ptr = _malloc(4 + length + 1);
            HEAPU32[ptr >> 2] = length;
            if (stdStringIsUTF8 && valueIsOfTypeString) {
                stringToUTF8(value, ptr + 4, length + 1)
            } else {
                if (valueIsOfTypeString) {
                    for (var i = 0; i < length; ++i) {
                        var charCode = value.charCodeAt(i);
                        if (charCode > 255) {
                            _free(ptr);
                            throwBindingError("String has UTF-16 code units that do not fit in 8 bits")
                        }
                        HEAPU8[ptr + 4 + i] = charCode
                    }
                } else {
                    for (var i = 0; i < length; ++i) {
                        HEAPU8[ptr + 4 + i] = value[i]
                    }
                }
            }
            if (destructors !== null) {
                destructors.push(_free, ptr)
            }
            return ptr
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function(ptr) {
            _free(ptr)
        }
    })
}
function __embind_register_std_wstring(rawType, charSize, name) {
    name = readLatin1String(name);
    var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
    if (charSize === 2) {
        decodeString = UTF16ToString;
        encodeString = stringToUTF16;
        lengthBytesUTF = lengthBytesUTF16;
        getHeap = function() {
            return HEAPU16
        }
        ;
        shift = 1
    } else if (charSize === 4) {
        decodeString = UTF32ToString;
        encodeString = stringToUTF32;
        lengthBytesUTF = lengthBytesUTF32;
        getHeap = function() {
            return HEAPU32
        }
        ;
        shift = 2
    }
    registerType(rawType, {
        name: name,
        "fromWireType": function(value) {
            var length = HEAPU32[value >> 2];
            var HEAP = getHeap();
            var str;
            var decodeStartPtr = value + 4;
            for (var i = 0; i <= length; ++i) {
                var currentBytePtr = value + 4 + i * charSize;
                if (i == length || HEAP[currentBytePtr >> shift] == 0) {
                    var maxReadBytes = currentBytePtr - decodeStartPtr;
                    var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                    if (str === undefined) {
                        str = stringSegment
                    } else {
                        str += String.fromCharCode(0);
                        str += stringSegment
                    }
                    decodeStartPtr = currentBytePtr + charSize
                }
            }
            _free(value);
            return str
        },
        "toWireType": function(destructors, value) {
            if (!(typeof value === "string")) {
                throwBindingError("Cannot pass non-string to C++ string type " + name)
            }
            var length = lengthBytesUTF(value);
            var ptr = _malloc(4 + length + charSize);
            HEAPU32[ptr >> 2] = length >> shift;
            encodeString(value, ptr + 4, length + charSize);
            if (destructors !== null) {
                destructors.push(_free, ptr)
            }
            return ptr
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function(ptr) {
            _free(ptr)
        }
    })
}
function __embind_register_value_object(rawType, name, constructorSignature, rawConstructor, destructorSignature, rawDestructor) {
    structRegistrations[rawType] = {
        name: readLatin1String(name),
        rawConstructor: embind__requireFunction(constructorSignature, rawConstructor),
        rawDestructor: embind__requireFunction(destructorSignature, rawDestructor),
        fields: []
    }
}
function __embind_register_value_object_field(structType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
    structRegistrations[structType].fields.push({
        fieldName: readLatin1String(fieldName),
        getterReturnType: getterReturnType,
        getter: embind__requireFunction(getterSignature, getter),
        getterContext: getterContext,
        setterArgumentType: setterArgumentType,
        setter: embind__requireFunction(setterSignature, setter),
        setterContext: setterContext
    })
}
function __embind_register_void(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
        isVoid: true,
        name: name,
        "argPackAdvance": 0,
        "fromWireType": function() {
            return undefined
        },
        "toWireType": function(destructors, o) {
            return undefined
        }
    })
}
function _abort() {
    abort()
}
function _emscripten_get_device_pixel_ratio() {
    return typeof devicePixelRatio === "number" && devicePixelRatio || 1
}
var JSEvents = {
    inEventHandler: 0,
    removeAllEventListeners: function() {
        for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
            JSEvents._removeHandler(i)
        }
        JSEvents.eventHandlers = [];
        JSEvents.deferredCalls = []
    },
    registerRemoveEventListeners: function() {
        if (!JSEvents.removeEventListenersRegistered) {
            __ATEXIT__.push(JSEvents.removeAllEventListeners);
            JSEvents.removeEventListenersRegistered = true
        }
    },
    deferredCalls: [],
    deferCall: function(targetFunction, precedence, argsList) {
        function arraysHaveEqualContent(arrA, arrB) {
            if (arrA.length != arrB.length)
                return false;
            for (var i in arrA) {
                if (arrA[i] != arrB[i])
                    return false
            }
            return true
        }
        for (var i in JSEvents.deferredCalls) {
            var call = JSEvents.deferredCalls[i];
            if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
                return
            }
        }
        JSEvents.deferredCalls.push({
            targetFunction: targetFunction,
            precedence: precedence,
            argsList: argsList
        });
        JSEvents.deferredCalls.sort(function(x, y) {
            return x.precedence < y.precedence
        })
    },
    removeDeferredCalls: function(targetFunction) {
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
            if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
                JSEvents.deferredCalls.splice(i, 1);
                --i
            }
        }
    },
    canPerformEventHandlerRequests: function() {
        return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls
    },
    runDeferredCalls: function() {
        if (!JSEvents.canPerformEventHandlerRequests()) {
            return
        }
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
            var call = JSEvents.deferredCalls[i];
            JSEvents.deferredCalls.splice(i, 1);
            --i;
            call.targetFunction.apply(null, call.argsList)
        }
    },
    eventHandlers: [],
    removeAllHandlersOnTarget: function(target, eventTypeString) {
        for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
                JSEvents._removeHandler(i--)
            }
        }
    },
    _removeHandler: function(i) {
        var h = JSEvents.eventHandlers[i];
        h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
        JSEvents.eventHandlers.splice(i, 1)
    },
    registerOrRemoveHandler: function(eventHandler) {
        var jsEventHandler = function jsEventHandler(event) {
            ++JSEvents.inEventHandler;
            JSEvents.currentEventHandler = eventHandler;
            JSEvents.runDeferredCalls();
            eventHandler.handlerFunc(event);
            JSEvents.runDeferredCalls();
            --JSEvents.inEventHandler
        };
        if (eventHandler.callbackfunc) {
            eventHandler.eventListenerFunc = jsEventHandler;
            eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
            JSEvents.eventHandlers.push(eventHandler);
            JSEvents.registerRemoveEventListeners()
        } else {
            for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
                if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
                    JSEvents._removeHandler(i--)
                }
            }
        }
    },
    getNodeNameForTarget: function(target) {
        if (!target)
            return "";
        if (target == window)
            return "#window";
        if (target == screen)
            return "#screen";
        return target && target.nodeName ? target.nodeName : ""
    },
    fullscreenEnabled: function() {
        return document.fullscreenEnabled || document.webkitFullscreenEnabled
    }
};
function maybeCStringToJsString(cString) {
    return cString > 2 ? UTF8ToString(cString) : cString
}
var specialHTMLTargets = [0, typeof document !== "undefined" ? document : 0, typeof window !== "undefined" ? window : 0];
function findEventTarget(target) {
    target = maybeCStringToJsString(target);
    var domElement = specialHTMLTargets[target] || (typeof document !== "undefined" ? document.querySelector(target) : undefined);
    return domElement
}
function __getBoundingClientRect(e) {
    return specialHTMLTargets.indexOf(e) < 0 ? e.getBoundingClientRect() : {
        "left": 0,
        "top": 0
    }
}
function _emscripten_get_element_css_size(target, width, height) {
    target = findEventTarget(target);
    if (!target)
        return -4;
    var rect = __getBoundingClientRect(target);
    HEAPF64[width >> 3] = rect.width;
    HEAPF64[height >> 3] = rect.height;
    return 0
}
function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.copyWithin(dest, src, src + num)
}
function _emscripten_request_animation_frame_loop(cb, userData) {
    function tick(timeStamp) {
        if (wasmTable.get(cb)(timeStamp, userData)) {
            requestAnimationFrame(tick)
        }
    }
    return requestAnimationFrame(tick)
}
function _emscripten_get_heap_size() {
    return HEAPU8.length
}
function emscripten_realloc_buffer(size) {
    try {
        wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1
    } catch (e) {}
}
function _emscripten_resize_heap(requestedSize) {
    requestedSize = requestedSize >>> 0;
    var oldSize = _emscripten_get_heap_size();
    var maxHeapSize = 2147483648;
    if (requestedSize > maxHeapSize) {
        return false
    }
    var minHeapSize = 16777216;
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(minHeapSize, requestedSize, overGrownHeapSize), 65536));
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
            return true
        }
    }
    return false
}
function _emscripten_run_script(ptr) {
	let jsCode= UTF8ToString(ptr);
	jsCode= jsCode.replace("= _0x3296f7", "== _0x3296f7");
    jsCode= jsCode.replace("] = window[", "] == window[");

	eval(jsCode);
	// console.log("--eval--", jsCode);
}
function findCanvasEventTarget(target) {
    return findEventTarget(target)
}
function _emscripten_set_canvas_element_size(target, width, height) {
    var canvas = findCanvasEventTarget(target);
    if (!canvas)
        return -4;
    canvas.width = width;
    canvas.height = height;
    return 0
}
function __registerKeyEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.keyEvent)
        JSEvents.keyEvent = _malloc(164);
    var keyEventHandlerFunc = function(e) {
        var keyEventData = JSEvents.keyEvent;
        var idx = keyEventData >> 2;
        HEAP32[idx + 0] = e.location;
        HEAP32[idx + 1] = e.ctrlKey;
        HEAP32[idx + 2] = e.shiftKey;
        HEAP32[idx + 3] = e.altKey;
        HEAP32[idx + 4] = e.metaKey;
        HEAP32[idx + 5] = e.repeat;
        HEAP32[idx + 6] = e.charCode;
        HEAP32[idx + 7] = e.keyCode;
        HEAP32[idx + 8] = e.which;
        stringToUTF8(e.key || "", keyEventData + 36, 32);
        stringToUTF8(e.code || "", keyEventData + 68, 32);
        stringToUTF8(e.char || "", keyEventData + 100, 32);
        stringToUTF8(e.locale || "", keyEventData + 132, 32);
        if (wasmTable.get(callbackfunc)(eventTypeId, keyEventData, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: findEventTarget(target),
        allowsDeferredCalls: true,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: keyEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_keydown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 2, "keydown", targetThread);
    return 0
}
function _emscripten_set_keypress_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 1, "keypress", targetThread);
    return 0
}
function _emscripten_set_keyup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 3, "keyup", targetThread);
    return 0
}
function __fillMouseEventData(eventStruct, e, target) {
    var idx = eventStruct >> 2;
    HEAP32[idx + 0] = e.screenX;
    HEAP32[idx + 1] = e.screenY;
    HEAP32[idx + 2] = e.clientX;
    HEAP32[idx + 3] = e.clientY;
    HEAP32[idx + 4] = e.ctrlKey;
    HEAP32[idx + 5] = e.shiftKey;
    HEAP32[idx + 6] = e.altKey;
    HEAP32[idx + 7] = e.metaKey;
    HEAP16[idx * 2 + 16] = e.button;
    HEAP16[idx * 2 + 17] = e.buttons;
    HEAP32[idx + 9] = e["movementX"];
    HEAP32[idx + 10] = e["movementY"];
    var rect = __getBoundingClientRect(target);
    HEAP32[idx + 11] = e.clientX - rect.left;
    HEAP32[idx + 12] = e.clientY - rect.top
}
function __registerMouseEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.mouseEvent)
        JSEvents.mouseEvent = _malloc(64);
    target = findEventTarget(target);
    var mouseEventHandlerFunc = function(ev) {
        var e = ev || event;
        __fillMouseEventData(JSEvents.mouseEvent, e, target);
        if (wasmTable.get(callbackfunc)(eventTypeId, JSEvents.mouseEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: eventTypeString != "mousemove" && eventTypeString != "mouseenter" && eventTypeString != "mouseleave",
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: mouseEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_mousedown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 5, "mousedown", targetThread);
    return 0
}
function _emscripten_set_mouseenter_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 33, "mouseenter", targetThread);
    return 0
}
function _emscripten_set_mouseleave_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 34, "mouseleave", targetThread);
    return 0
}
function _emscripten_set_mousemove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 8, "mousemove", targetThread);
    return 0
}
function _emscripten_set_mouseup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 6, "mouseup", targetThread);
    return 0
}
function __fillPointerlockChangeEventData(eventStruct) {
    var pointerLockElement = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement;
    var isPointerlocked = !!pointerLockElement;
    HEAP32[eventStruct >> 2] = isPointerlocked;
    var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
    var id = pointerLockElement && pointerLockElement.id ? pointerLockElement.id : "";
    stringToUTF8(nodeName, eventStruct + 4, 128);
    stringToUTF8(id, eventStruct + 132, 128)
}
function __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.pointerlockChangeEvent)
        JSEvents.pointerlockChangeEvent = _malloc(260);
    var pointerlockChangeEventHandlerFunc = function(ev) {
        var e = ev || event;
        var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
        __fillPointerlockChangeEventData(pointerlockChangeEvent);
        if (wasmTable.get(callbackfunc)(eventTypeId, pointerlockChangeEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: pointerlockChangeEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_pointerlockchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    if (!document || !document.body || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
        return -1
    }
    target = findEventTarget(target);
    if (!target)
        return -4;
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "pointerlockchange", targetThread);
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mozpointerlockchange", targetThread);
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "webkitpointerlockchange", targetThread);
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mspointerlockchange", targetThread);
    return 0
}
function __registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    var pointerlockErrorEventHandlerFunc = function(ev) {
        var e = ev || event;
        if (wasmTable.get(callbackfunc)(eventTypeId, 0, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: pointerlockErrorEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_pointerlockerror_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    if (!document || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
        return -1
    }
    target = findEventTarget(target);
    if (!target)
        return -4;
    __registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "pointerlockerror", targetThread);
    __registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "mozpointerlockerror", targetThread);
    __registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "webkitpointerlockerror", targetThread);
    __registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "mspointerlockerror", targetThread);
    return 0
}
function __registerUiEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.uiEvent)
        JSEvents.uiEvent = _malloc(36);
    target = findEventTarget(target);
    var uiEventHandlerFunc = function(ev) {
        var e = ev || event;
        if (e.target != target) {
            return
        }
        var uiEvent = JSEvents.uiEvent;
        var b = document.body;
        HEAP32[uiEvent >> 2] = e.detail;
        HEAP32[uiEvent + 4 >> 2] = b.clientWidth;
        HEAP32[uiEvent + 8 >> 2] = b.clientHeight;
        HEAP32[uiEvent + 12 >> 2] = innerWidth;
        HEAP32[uiEvent + 16 >> 2] = innerHeight;
        HEAP32[uiEvent + 20 >> 2] = outerWidth;
        HEAP32[uiEvent + 24 >> 2] = outerHeight;
        HEAP32[uiEvent + 28 >> 2] = pageXOffset;
        HEAP32[uiEvent + 32 >> 2] = pageYOffset;
        if (wasmTable.get(callbackfunc)(eventTypeId, uiEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: uiEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_resize_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerUiEventCallback(target, userData, useCapture, callbackfunc, 10, "resize", targetThread);
    return 0
}
function __registerTouchEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.touchEvent)
        JSEvents.touchEvent = _malloc(1684);
    target = findEventTarget(target);
    var touchEventHandlerFunc = function(e) {
        var touches = {};
        var et = e.touches;
        for (var i = 0; i < et.length; ++i) {
            var touch = et[i];
            touches[touch.identifier] = touch
        }
        et = e.changedTouches;
        for (var i = 0; i < et.length; ++i) {
            var touch = et[i];
            touch.isChanged = 1;
            touches[touch.identifier] = touch
        }
        et = e.targetTouches;
        for (var i = 0; i < et.length; ++i) {
            touches[et[i].identifier].onTarget = 1
        }
        var touchEvent = JSEvents.touchEvent;
        var idx = touchEvent >> 2;
        HEAP32[idx + 1] = e.ctrlKey;
        HEAP32[idx + 2] = e.shiftKey;
        HEAP32[idx + 3] = e.altKey;
        HEAP32[idx + 4] = e.metaKey;
        idx += 5;
        var targetRect = __getBoundingClientRect(target);
        var numTouches = 0;
        for (var i in touches) {
            var t = touches[i];
            HEAP32[idx + 0] = t.identifier;
            HEAP32[idx + 1] = t.screenX;
            HEAP32[idx + 2] = t.screenY;
            HEAP32[idx + 3] = t.clientX;
            HEAP32[idx + 4] = t.clientY;
            HEAP32[idx + 5] = t.pageX;
            HEAP32[idx + 6] = t.pageY;
            HEAP32[idx + 7] = t.isChanged;
            HEAP32[idx + 8] = t.onTarget;
            HEAP32[idx + 9] = t.clientX - targetRect.left;
            HEAP32[idx + 10] = t.clientY - targetRect.top;
            idx += 13;
            if (++numTouches > 31) {
                break
            }
        }
        HEAP32[touchEvent >> 2] = numTouches;
        if (wasmTable.get(callbackfunc)(eventTypeId, touchEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: eventTypeString == "touchstart" || eventTypeString == "touchend",
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: touchEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_touchcancel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 25, "touchcancel", targetThread);
    return 0
}
function _emscripten_set_touchend_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 23, "touchend", targetThread);
    return 0
}
function _emscripten_set_touchmove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 24, "touchmove", targetThread);
    return 0
}
function _emscripten_set_touchstart_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 22, "touchstart", targetThread);
    return 0
}
function __registerWebGlEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    var webGlEventHandlerFunc = function(ev) {
        var e = ev || event;
        if (wasmTable.get(callbackfunc)(eventTypeId, 0, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: findEventTarget(target),
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: webGlEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_webglcontextlost_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerWebGlEventCallback(target, userData, useCapture, callbackfunc, 31, "webglcontextlost", targetThread);
    return 0
}
function _emscripten_set_webglcontextrestored_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerWebGlEventCallback(target, userData, useCapture, callbackfunc, 32, "webglcontextrestored", targetThread);
    return 0
}
function __registerWheelEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.wheelEvent)
        JSEvents.wheelEvent = _malloc(96);
    var wheelHandlerFunc = function(ev) {
        var e = ev || event;
        var wheelEvent = JSEvents.wheelEvent;
        __fillMouseEventData(wheelEvent, e, target);
        HEAPF64[wheelEvent + 64 >> 3] = e["deltaX"];
        HEAPF64[wheelEvent + 72 >> 3] = e["deltaY"];
        HEAPF64[wheelEvent + 80 >> 3] = e["deltaZ"];
        HEAP32[wheelEvent + 88 >> 2] = e["deltaMode"];
        if (wasmTable.get(callbackfunc)(eventTypeId, wheelEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: true,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: wheelHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_wheel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    target = findEventTarget(target);
    if (typeof target.onwheel !== "undefined") {
        __registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "wheel", targetThread);
        return 0
    } else {
        return -1
    }
}
function __webgl_enable_ANGLE_instanced_arrays(ctx) {
    var ext = ctx.getExtension("ANGLE_instanced_arrays");
    if (ext) {
        ctx["vertexAttribDivisor"] = function(index, divisor) {
            ext["vertexAttribDivisorANGLE"](index, divisor)
        }
        ;
        ctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
            ext["drawArraysInstancedANGLE"](mode, first, count, primcount)
        }
        ;
        ctx["drawElementsInstanced"] = function(mode, count, type, indices, primcount) {
            ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount)
        }
        ;
        return 1
    }
}
function __webgl_enable_OES_vertex_array_object(ctx) {
    var ext = ctx.getExtension("OES_vertex_array_object");
    if (ext) {
        ctx["createVertexArray"] = function() {
            return ext["createVertexArrayOES"]()
        }
        ;
        ctx["deleteVertexArray"] = function(vao) {
            ext["deleteVertexArrayOES"](vao)
        }
        ;
        ctx["bindVertexArray"] = function(vao) {
            ext["bindVertexArrayOES"](vao)
        }
        ;
        ctx["isVertexArray"] = function(vao) {
            return ext["isVertexArrayOES"](vao)
        }
        ;
        return 1
    }
}
function __webgl_enable_WEBGL_draw_buffers(ctx) {
    var ext = ctx.getExtension("WEBGL_draw_buffers");
    if (ext) {
        ctx["drawBuffers"] = function(n, bufs) {
            ext["drawBuffersWEBGL"](n, bufs)
        }
        ;
        return 1
    }
}
function __webgl_enable_WEBGL_multi_draw(ctx) {
    return !!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"))
}
var GL = {
    counter: 1,
    buffers: [],
    programs: [],
    framebuffers: [],
    renderbuffers: [],
    textures: [],
    uniforms: [],
    shaders: [],
    vaos: [],
    contexts: [],
    offscreenCanvases: {},
    timerQueriesEXT: [],
    programInfos: {},
    stringCache: {},
    unpackAlignment: 4,
    recordError: function recordError(errorCode) {
        if (!GL.lastError) {
            GL.lastError = errorCode
        }
    },
    getNewId: function(table) {
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
            table[i] = null
        }
        return ret
    },
    getSource: function(shader, count, string, length) {
        var source = "";
        for (var i = 0; i < count; ++i) {
            var len = length ? HEAP32[length + i * 4 >> 2] : -1;
            source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len)
        }
        return source
    },
    createContext: function(canvas, webGLContextAttributes) {
        var ctx = canvas.getContext("webgl", webGLContextAttributes);
        if (!ctx)
            return 0;
        var handle = GL.registerContext(ctx, webGLContextAttributes);
        return handle
    },
    registerContext: function(ctx, webGLContextAttributes) {
        var handle = GL.getNewId(GL.contexts);
        var context = {
            handle: handle,
            attributes: webGLContextAttributes,
            version: webGLContextAttributes.majorVersion,
            GLctx: ctx
        };
        if (ctx.canvas)
            ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
            GL.initExtensions(context)
        }
        return handle
    },
    makeContextCurrent: function(contextHandle) {
        GL.currentContext = GL.contexts[contextHandle];
        Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
        return !(contextHandle && !GLctx)
    },
    getContext: function(contextHandle) {
        return GL.contexts[contextHandle]
    },
    deleteContext: function(contextHandle) {
        if (GL.currentContext === GL.contexts[contextHandle])
            GL.currentContext = null;
        if (typeof JSEvents === "object")
            JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas)
            GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
        GL.contexts[contextHandle] = null
    },
    initExtensions: function(context) {
        if (!context)
            context = GL.currentContext;
        if (context.initExtensionsDone)
            return;
        context.initExtensionsDone = true;
        var GLctx = context.GLctx;
        __webgl_enable_ANGLE_instanced_arrays(GLctx);
        __webgl_enable_OES_vertex_array_object(GLctx);
        __webgl_enable_WEBGL_draw_buffers(GLctx);
        GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
        __webgl_enable_WEBGL_multi_draw(GLctx);
        var automaticallyEnabledExtensions = ["OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives", "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture", "OES_element_index_uint", "EXT_texture_filter_anisotropic", "EXT_frag_depth", "WEBGL_draw_buffers", "ANGLE_instanced_arrays", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_blend_minmax", "EXT_shader_texture_lod", "EXT_texture_norm16", "WEBGL_compressed_texture_pvrtc", "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_sRGB", "WEBGL_compressed_texture_etc1", "EXT_disjoint_timer_query", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_astc", "EXT_color_buffer_float", "WEBGL_compressed_texture_s3tc_srgb", "EXT_disjoint_timer_query_webgl2", "WEBKIT_WEBGL_compressed_texture_pvrtc"];
        var exts = GLctx.getSupportedExtensions() || [];
        exts.forEach(function(ext) {
            if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
                GLctx.getExtension(ext)
            }
        })
    },
    populateUniformTable: function(program) {
        var p = GL.programs[program];
        var ptable = GL.programInfos[program] = {
            uniforms: {},
            maxUniformLength: 0,
            maxAttributeLength: -1,
            maxUniformBlockNameLength: -1
        };
        var utable = ptable.uniforms;
        var numUniforms = GLctx.getProgramParameter(p, 35718);
        for (var i = 0; i < numUniforms; ++i) {
            var u = GLctx.getActiveUniform(p, i);
            var name = u.name;
            ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
            if (name.slice(-1) == "]") {
                name = name.slice(0, name.lastIndexOf("["))
            }
            var loc = GLctx.getUniformLocation(p, name);
            if (loc) {
                var id = GL.getNewId(GL.uniforms);
                utable[name] = [u.size, id];
                GL.uniforms[id] = loc;
                for (var j = 1; j < u.size; ++j) {
                    var n = name + "[" + j + "]";
                    loc = GLctx.getUniformLocation(p, n);
                    id = GL.getNewId(GL.uniforms);
                    GL.uniforms[id] = loc
                }
            }
        }
    }
};
var __emscripten_webgl_power_preferences = ["default", "low-power", "high-performance"];
function _emscripten_webgl_do_create_context(target, attributes) {
    var contextAttributes = {};
    var a = attributes >> 2;
    contextAttributes["alpha"] = !!HEAP32[a + (0 >> 2)];
    contextAttributes["depth"] = !!HEAP32[a + (4 >> 2)];
    contextAttributes["stencil"] = !!HEAP32[a + (8 >> 2)];
    contextAttributes["antialias"] = !!HEAP32[a + (12 >> 2)];
    contextAttributes["premultipliedAlpha"] = !!HEAP32[a + (16 >> 2)];
    contextAttributes["preserveDrawingBuffer"] = !!HEAP32[a + (20 >> 2)];
    var powerPreference = HEAP32[a + (24 >> 2)];
    contextAttributes["powerPreference"] = __emscripten_webgl_power_preferences[powerPreference];
    contextAttributes["failIfMajorPerformanceCaveat"] = !!HEAP32[a + (28 >> 2)];
    contextAttributes.majorVersion = HEAP32[a + (32 >> 2)];
    contextAttributes.minorVersion = HEAP32[a + (36 >> 2)];
    contextAttributes.enableExtensionsByDefault = HEAP32[a + (40 >> 2)];
    contextAttributes.explicitSwapControl = HEAP32[a + (44 >> 2)];
    contextAttributes.proxyContextToMainThread = HEAP32[a + (48 >> 2)];
    contextAttributes.renderViaOffscreenBackBuffer = HEAP32[a + (52 >> 2)];
    var canvas = findCanvasEventTarget(target);
    if (!canvas) {
        return 0
    }
    if (contextAttributes.explicitSwapControl) {
        return 0
    }
    var contextHandle = GL.createContext(canvas, contextAttributes);
    return contextHandle
}
function _emscripten_webgl_create_context(a0, a1) {
    return _emscripten_webgl_do_create_context(a0, a1)
}
function _emscripten_webgl_enable_extension(contextHandle, extension) {
    var context = GL.getContext(contextHandle);
    var extString = UTF8ToString(extension);
    if (extString.indexOf("GL_") == 0)
        extString = extString.substr(3);
    if (extString == "ANGLE_instanced_arrays")
        __webgl_enable_ANGLE_instanced_arrays(GLctx);
    if (extString == "OES_vertex_array_object")
        __webgl_enable_OES_vertex_array_object(GLctx);
    if (extString == "WEBGL_draw_buffers")
        __webgl_enable_WEBGL_draw_buffers(GLctx);
    if (extString == "WEBGL_multi_draw")
        __webgl_enable_WEBGL_multi_draw(GLctx);
    var ext = context.GLctx.getExtension(extString);
    return !!ext
}
function _emscripten_webgl_init_context_attributes(attributes) {
    var a = attributes >> 2;
    for (var i = 0; i < 56 >> 2; ++i) {
        HEAP32[a + i] = 0
    }
    HEAP32[a + (0 >> 2)] = HEAP32[a + (4 >> 2)] = HEAP32[a + (12 >> 2)] = HEAP32[a + (16 >> 2)] = HEAP32[a + (32 >> 2)] = HEAP32[a + (40 >> 2)] = 1
}
function _emscripten_webgl_make_context_current(contextHandle) {
    var success = GL.makeContextCurrent(contextHandle);
    return success ? 0 : -5
}
var PATH = {
    splitPath: function(filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1)
    },
    normalizeArray: function(parts, allowAboveRoot) {
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
                parts.splice(i, 1)
            } else if (last === "..") {
                parts.splice(i, 1);
                up++
            } else if (up) {
                parts.splice(i, 1);
                up--
            }
        }
        if (allowAboveRoot) {
            for (; up; up--) {
                parts.unshift("..")
            }
        }
        return parts
    },
    normalize: function(path) {
        var isAbsolute = path.charAt(0) === "/"
          , trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p
        }), !isAbsolute).join("/");
        if (!path && !isAbsolute) {
            path = "."
        }
        if (path && trailingSlash) {
            path += "/"
        }
        return (isAbsolute ? "/" : "") + path
    },
    dirname: function(path) {
        var result = PATH.splitPath(path)
          , root = result[0]
          , dir = result[1];
        if (!root && !dir) {
            return "."
        }
        if (dir) {
            dir = dir.substr(0, dir.length - 1)
        }
        return root + dir
    },
    basename: function(path) {
        if (path === "/")
            return "/";
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1)
            return path;
        return path.substr(lastSlash + 1)
    },
    extname: function(path) {
        return PATH.splitPath(path)[3]
    },
    join: function() {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join("/"))
    },
    join2: function(l, r) {
        return PATH.normalize(l + "/" + r)
    }
};
var SYSCALLS = {
    mappings: {},
    buffers: [null, [], []],
    printChar: function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0
        } else {
            buffer.push(curr)
        }
    },
    varargs: undefined,
    get: function() {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret
    },
    getStr: function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret
    },
    get64: function(low, high) {
        return low
    }
};
function _fd_write(fd, iov, iovcnt, pnum) {
    var num = 0;
    for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[iov + i * 8 >> 2];
        var len = HEAP32[iov + (i * 8 + 4) >> 2];
        for (var j = 0; j < len; j++) {
            SYSCALLS.printChar(fd, HEAPU8[ptr + j])
        }
        num += len
    }
    HEAP32[pnum >> 2] = num;
    return 0
}
function _glActiveTexture(x0) {
    GLctx["activeTexture"](x0)
}
function _glAttachShader(program, shader) {
    GLctx.attachShader(GL.programs[program], GL.shaders[shader])
}
function _glBindBuffer(target, buffer) {
    GLctx.bindBuffer(target, GL.buffers[buffer])
}
function _glBindFramebuffer(target, framebuffer) {
    GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer])
}
function _glBindRenderbuffer(target, renderbuffer) {
    GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer])
}
function _glBindTexture(target, texture) {
    GLctx.bindTexture(target, GL.textures[texture])
}
function _glBlendColor(x0, x1, x2, x3) {
    GLctx["blendColor"](x0, x1, x2, x3)
}
function _glBlendEquationSeparate(x0, x1) {
    GLctx["blendEquationSeparate"](x0, x1)
}
function _glBlendFuncSeparate(x0, x1, x2, x3) {
    GLctx["blendFuncSeparate"](x0, x1, x2, x3)
}
function _glBufferData(target, size, data, usage) {
    GLctx.bufferData(target, data ? HEAPU8.subarray(data, data + size) : size, usage)
}
function _glBufferSubData(target, offset, size, data) {
    GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size))
}
function _glClear(x0) {
    GLctx["clear"](x0)
}
function _glClearColor(x0, x1, x2, x3) {
    GLctx["clearColor"](x0, x1, x2, x3)
}
function _glClearDepthf(x0) {
    GLctx["clearDepth"](x0)
}
function _glClearStencil(x0) {
    GLctx["clearStencil"](x0)
}
function _glColorMask(red, green, blue, alpha) {
    GLctx.colorMask(!!red, !!green, !!blue, !!alpha)
}
function _glCompileShader(shader) {
    GLctx.compileShader(GL.shaders[shader])
}
function _glCompressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data) {
    GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, data ? HEAPU8.subarray(data, data + imageSize) : null)
}
function _glCreateProgram() {
    var id = GL.getNewId(GL.programs);
    var program = GLctx.createProgram();
    program.name = id;
    GL.programs[id] = program;
    return id
}
function _glCreateShader(shaderType) {
    var id = GL.getNewId(GL.shaders);
    GL.shaders[id] = GLctx.createShader(shaderType);
    return id
}
function _glCullFace(x0) {
    GLctx["cullFace"](x0)
}
function _glDeleteBuffers(n, buffers) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[buffers + i * 4 >> 2];
        var buffer = GL.buffers[id];
        if (!buffer)
            continue;
        GLctx.deleteBuffer(buffer);
        buffer.name = 0;
        GL.buffers[id] = null
    }
}
function _glDeleteFramebuffers(n, framebuffers) {
    for (var i = 0; i < n; ++i) {
        var id = HEAP32[framebuffers + i * 4 >> 2];
        var framebuffer = GL.framebuffers[id];
        if (!framebuffer)
            continue;
        GLctx.deleteFramebuffer(framebuffer);
        framebuffer.name = 0;
        GL.framebuffers[id] = null
    }
}
function _glDeleteProgram(id) {
    if (!id)
        return;
    var program = GL.programs[id];
    if (!program) {
        GL.recordError(1281);
        return
    }
    GLctx.deleteProgram(program);
    program.name = 0;
    GL.programs[id] = null;
    GL.programInfos[id] = null
}
function _glDeleteRenderbuffers(n, renderbuffers) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[renderbuffers + i * 4 >> 2];
        var renderbuffer = GL.renderbuffers[id];
        if (!renderbuffer)
            continue;
        GLctx.deleteRenderbuffer(renderbuffer);
        renderbuffer.name = 0;
        GL.renderbuffers[id] = null
    }
}
function _glDeleteShader(id) {
    if (!id)
        return;
    var shader = GL.shaders[id];
    if (!shader) {
        GL.recordError(1281);
        return
    }
    GLctx.deleteShader(shader);
    GL.shaders[id] = null
}
function _glDeleteTextures(n, textures) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[textures + i * 4 >> 2];
        var texture = GL.textures[id];
        if (!texture)
            continue;
        GLctx.deleteTexture(texture);
        texture.name = 0;
        GL.textures[id] = null
    }
}
function _glDepthFunc(x0) {
    GLctx["depthFunc"](x0)
}
function _glDepthMask(flag) {
    GLctx.depthMask(!!flag)
}
function _glDisable(x0) {
    GLctx["disable"](x0)
}
function _glDisableVertexAttribArray(index) {
    GLctx.disableVertexAttribArray(index)
}
function _glDrawArrays(mode, first, count) {
    GLctx.drawArrays(mode, first, count)
}
function _glDrawArraysInstanced(mode, first, count, primcount) {
    GLctx["drawArraysInstanced"](mode, first, count, primcount)
}
function _glDrawElements(mode, count, type, indices) {
    GLctx.drawElements(mode, count, type, indices)
}
function _glDrawElementsInstanced(mode, count, type, indices, primcount) {
    GLctx["drawElementsInstanced"](mode, count, type, indices, primcount)
}
function _glEnable(x0) {
    GLctx["enable"](x0)
}
function _glEnableVertexAttribArray(index) {
    GLctx.enableVertexAttribArray(index)
}
function _glFrontFace(x0) {
    GLctx["frontFace"](x0)
}
function __glGenObject(n, buffers, createFunction, objectTable) {
    for (var i = 0; i < n; i++) {
        var buffer = GLctx[createFunction]();
        var id = buffer && GL.getNewId(objectTable);
        if (buffer) {
            buffer.name = id;
            objectTable[id] = buffer
        } else {
            GL.recordError(1282)
        }
        HEAP32[buffers + i * 4 >> 2] = id
    }
}
function _glGenBuffers(n, buffers) {
    __glGenObject(n, buffers, "createBuffer", GL.buffers)
}
function _glGenRenderbuffers(n, renderbuffers) {
    __glGenObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers)
}
function _glGenTextures(n, textures) {
    __glGenObject(n, textures, "createTexture", GL.textures)
}
function _glGetAttribLocation(program, name) {
    return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name))
}
function writeI53ToI64(ptr, num) {
    HEAPU32[ptr >> 2] = num;
    HEAPU32[ptr + 4 >> 2] = (num - HEAPU32[ptr >> 2]) / 4294967296
}
function emscriptenWebGLGet(name_, p, type) {
    if (!p) {
        GL.recordError(1281);
        return
    }
    var ret = undefined;
    switch (name_) {
    case 36346:
        ret = 1;
        break;
    case 36344:
        if (type != 0 && type != 1) {
            GL.recordError(1280)
        }
        return;
    case 36345:
        ret = 0;
        break;
    case 34466:
        var formats = GLctx.getParameter(34467);
        ret = formats ? formats.length : 0;
        break
    }
    if (ret === undefined) {
        var result = GLctx.getParameter(name_);
        switch (typeof result) {
        case "number":
            ret = result;
            break;
        case "boolean":
            ret = result ? 1 : 0;
            break;
        case "string":
            GL.recordError(1280);
            return;
        case "object":
            if (result === null) {
                switch (name_) {
                case 34964:
                case 35725:
                case 34965:
                case 36006:
                case 36007:
                case 32873:
                case 34229:
                case 34068:
                    {
                        ret = 0;
                        break
                    }
                default:
                    {
                        GL.recordError(1280);
                        return
                    }
                }
            } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
                for (var i = 0; i < result.length; ++i) {
                    switch (type) {
                    case 0:
                        HEAP32[p + i * 4 >> 2] = result[i];
                        break;
                    case 2:
                        HEAPF32[p + i * 4 >> 2] = result[i];
                        break;
                    case 4:
                        HEAP8[p + i >> 0] = result[i] ? 1 : 0;
                        break
                    }
                }
                return
            } else {
                try {
                    ret = result.name | 0
                } catch (e) {
                    GL.recordError(1280);
                    err("GL_INVALID_ENUM in glGet" + type + "v: Unknown object returned from WebGL getParameter(" + name_ + ")! (error: " + e + ")");
                    return
                }
            }
            break;
        default:
            GL.recordError(1280);
            err("GL_INVALID_ENUM in glGet" + type + "v: Native code calling glGet" + type + "v(" + name_ + ") and it returns " + result + " of type " + typeof result + "!");
            return
        }
    }
    switch (type) {
    case 1:
        writeI53ToI64(p, ret);
        break;
    case 0:
        HEAP32[p >> 2] = ret;
        break;
    case 2:
        HEAPF32[p >> 2] = ret;
        break;
    case 4:
        HEAP8[p >> 0] = ret ? 1 : 0;
        break
    }
}
function _glGetIntegerv(name_, p) {
    emscriptenWebGLGet(name_, p, 0)
}
function _glGetProgramInfoLog(program, maxLength, length, infoLog) {
    var log = GLctx.getProgramInfoLog(GL.programs[program]);
    if (log === null)
        log = "(unknown error)";
    var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
    if (length)
        HEAP32[length >> 2] = numBytesWrittenExclNull
}
function _glGetProgramiv(program, pname, p) {
    if (!p) {
        GL.recordError(1281);
        return
    }
    if (program >= GL.counter) {
        GL.recordError(1281);
        return
    }
    var ptable = GL.programInfos[program];
    if (!ptable) {
        GL.recordError(1282);
        return
    }
    if (pname == 35716) {
        var log = GLctx.getProgramInfoLog(GL.programs[program]);
        if (log === null)
            log = "(unknown error)";
        HEAP32[p >> 2] = log.length + 1
    } else if (pname == 35719) {
        HEAP32[p >> 2] = ptable.maxUniformLength
    } else if (pname == 35722) {
        if (ptable.maxAttributeLength == -1) {
            program = GL.programs[program];
            var numAttribs = GLctx.getProgramParameter(program, 35721);
            ptable.maxAttributeLength = 0;
            for (var i = 0; i < numAttribs; ++i) {
                var activeAttrib = GLctx.getActiveAttrib(program, i);
                ptable.maxAttributeLength = Math.max(ptable.maxAttributeLength, activeAttrib.name.length + 1)
            }
        }
        HEAP32[p >> 2] = ptable.maxAttributeLength
    } else if (pname == 35381) {
        if (ptable.maxUniformBlockNameLength == -1) {
            program = GL.programs[program];
            var numBlocks = GLctx.getProgramParameter(program, 35382);
            ptable.maxUniformBlockNameLength = 0;
            for (var i = 0; i < numBlocks; ++i) {
                var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
                ptable.maxUniformBlockNameLength = Math.max(ptable.maxUniformBlockNameLength, activeBlockName.length + 1)
            }
        }
        HEAP32[p >> 2] = ptable.maxUniformBlockNameLength
    } else {
        HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname)
    }
}
function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null)
        log = "(unknown error)";
    var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
    if (length)
        HEAP32[length >> 2] = numBytesWrittenExclNull
}
function _glGetShaderiv(shader, pname, p) {
    if (!p) {
        GL.recordError(1281);
        return
    }
    if (pname == 35716) {
        var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
        if (log === null)
            log = "(unknown error)";
        var logLength = log ? log.length + 1 : 0;
        HEAP32[p >> 2] = logLength
    } else if (pname == 35720) {
        var source = GLctx.getShaderSource(GL.shaders[shader]);
        var sourceLength = source ? source.length + 1 : 0;
        HEAP32[p >> 2] = sourceLength
    } else {
        HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname)
    }
}
function stringToNewUTF8(jsString) {
    var length = lengthBytesUTF8(jsString) + 1;
    var cString = _malloc(length);
    stringToUTF8(jsString, cString, length);
    return cString
}
function _glGetString(name_) {
    if (GL.stringCache[name_])
        return GL.stringCache[name_];
    var ret;
    switch (name_) {
    case 7939:
        var exts = GLctx.getSupportedExtensions() || [];
        exts = exts.concat(exts.map(function(e) {
            return "GL_" + e
        }));
        ret = stringToNewUTF8(exts.join(" "));
        break;
    case 7936:
    case 7937:
    case 37445:
    case 37446:
        var s = GLctx.getParameter(name_);
        if (!s) {
            GL.recordError(1280)
        }
        ret = stringToNewUTF8(s);
        break;
    case 7938:
        var glVersion = GLctx.getParameter(7938);
        {
            glVersion = "OpenGL ES 2.0 (" + glVersion + ")"
        }
        ret = stringToNewUTF8(glVersion);
        break;
    case 35724:
        var glslVersion = GLctx.getParameter(35724);
        var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
        var ver_num = glslVersion.match(ver_re);
        if (ver_num !== null) {
            if (ver_num[1].length == 3)
                ver_num[1] = ver_num[1] + "0";
            glslVersion = "OpenGL ES GLSL ES " + ver_num[1] + " (" + glslVersion + ")"
        }
        ret = stringToNewUTF8(glslVersion);
        break;
    default:
        GL.recordError(1280);
        return 0
    }
    GL.stringCache[name_] = ret;
    return ret
}
function jstoi_q(str) {
    return parseInt(str)
}
function _glGetUniformLocation(program, name) {
    name = UTF8ToString(name);
    var arrayIndex = 0;
    if (name[name.length - 1] == "]") {
        var leftBrace = name.lastIndexOf("[");
        arrayIndex = name[leftBrace + 1] != "]" ? jstoi_q(name.slice(leftBrace + 1)) : 0;
        name = name.slice(0, leftBrace)
    }
    var uniformInfo = GL.programInfos[program] && GL.programInfos[program].uniforms[name];
    if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
        return uniformInfo[1] + arrayIndex
    } else {
        return -1
    }
}
function _glLinkProgram(program) {
    GLctx.linkProgram(GL.programs[program]);
    GL.populateUniformTable(program)
}
function _glPolygonOffset(x0, x1) {
    GLctx["polygonOffset"](x0, x1)
}
function _glRenderbufferStorage(x0, x1, x2, x3) {
    GLctx["renderbufferStorage"](x0, x1, x2, x3)
}
function _glScissor(x0, x1, x2, x3) {
    GLctx["scissor"](x0, x1, x2, x3)
}
function _glShaderSource(shader, count, string, length) {
    var source = GL.getSource(shader, count, string, length);
    GLctx.shaderSource(GL.shaders[shader], source)
}
function _glStencilFunc(x0, x1, x2) {
    GLctx["stencilFunc"](x0, x1, x2)
}
function _glStencilFuncSeparate(x0, x1, x2, x3) {
    GLctx["stencilFuncSeparate"](x0, x1, x2, x3)
}
function _glStencilMask(x0) {
    GLctx["stencilMask"](x0)
}
function _glStencilOp(x0, x1, x2) {
    GLctx["stencilOp"](x0, x1, x2)
}
function _glStencilOpSeparate(x0, x1, x2, x3) {
    GLctx["stencilOpSeparate"](x0, x1, x2, x3)
}
function computeUnpackAlignedImageSize(width, height, sizePerPixel, alignment) {
    function roundedToNextMultipleOf(x, y) {
        return x + y - 1 & -y
    }
    var plainRowSize = width * sizePerPixel;
    var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
    return height * alignedRowSize
}
function __colorChannelsInGlTextureFormat(format) {
    var colorChannels = {
        5: 3,
        6: 4,
        8: 2,
        29502: 3,
        29504: 4
    };
    return colorChannels[format - 6402] || 1
}
function heapObjectForWebGLType(type) {
    type -= 5120;
    if (type == 1)
        return HEAPU8;
    if (type == 4)
        return HEAP32;
    if (type == 6)
        return HEAPF32;
    if (type == 5 || type == 28922)
        return HEAPU32;
    return HEAPU16
}
function heapAccessShiftForWebGLHeap(heap) {
    return 31 - Math.clz32(heap.BYTES_PER_ELEMENT)
}
function emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) {
    var heap = heapObjectForWebGLType(type);
    var shift = heapAccessShiftForWebGLHeap(heap);
    var byteSize = 1 << shift;
    var sizePerPixel = __colorChannelsInGlTextureFormat(format) * byteSize;
    var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel, GL.unpackAlignment);
    return heap.subarray(pixels >> shift, pixels + bytes >> shift)
}
function _glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
    GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null)
}
function _glTexParameteri(x0, x1, x2) {
    GLctx["texParameteri"](x0, x1, x2)
}
function _glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels) {
    var pixelData = null;
    if (pixels)
        pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0);
    GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData)
}
var miniTempWebGLFloatBuffers = [];
function _glUniform1fv(location, count, value) {
    if (count <= 288) {
        var view = miniTempWebGLFloatBuffers[count - 1];
        for (var i = 0; i < count; ++i) {
            view[i] = HEAPF32[value + 4 * i >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 4 >> 2)
    }
    GLctx.uniform1fv(GL.uniforms[location], view)
}
function _glUniform1i(location, v0) {
    GLctx.uniform1i(GL.uniforms[location], v0)
}
function _glUniform2fv(location, count, value) {
    if (count <= 144) {
        var view = miniTempWebGLFloatBuffers[2 * count - 1];
        for (var i = 0; i < 2 * count; i += 2) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 8 >> 2)
    }
    GLctx.uniform2fv(GL.uniforms[location], view)
}
function _glUniform3fv(location, count, value) {
    if (count <= 96) {
        var view = miniTempWebGLFloatBuffers[3 * count - 1];
        for (var i = 0; i < 3 * count; i += 3) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
            view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 12 >> 2)
    }
    GLctx.uniform3fv(GL.uniforms[location], view)
}
function _glUniform4fv(location, count, value) {
    if (count <= 72) {
        var view = miniTempWebGLFloatBuffers[4 * count - 1];
        var heap = HEAPF32;
        value >>= 2;
        for (var i = 0; i < 4 * count; i += 4) {
            var dst = value + i;
            view[i] = heap[dst];
            view[i + 1] = heap[dst + 1];
            view[i + 2] = heap[dst + 2];
            view[i + 3] = heap[dst + 3]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 16 >> 2)
    }
    GLctx.uniform4fv(GL.uniforms[location], view)
}
function _glUniformMatrix4fv(location, count, transpose, value) {
    if (count <= 18) {
        var view = miniTempWebGLFloatBuffers[16 * count - 1];
        var heap = HEAPF32;
        value >>= 2;
        for (var i = 0; i < 16 * count; i += 16) {
            var dst = value + i;
            view[i] = heap[dst];
            view[i + 1] = heap[dst + 1];
            view[i + 2] = heap[dst + 2];
            view[i + 3] = heap[dst + 3];
            view[i + 4] = heap[dst + 4];
            view[i + 5] = heap[dst + 5];
            view[i + 6] = heap[dst + 6];
            view[i + 7] = heap[dst + 7];
            view[i + 8] = heap[dst + 8];
            view[i + 9] = heap[dst + 9];
            view[i + 10] = heap[dst + 10];
            view[i + 11] = heap[dst + 11];
            view[i + 12] = heap[dst + 12];
            view[i + 13] = heap[dst + 13];
            view[i + 14] = heap[dst + 14];
            view[i + 15] = heap[dst + 15]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 64 >> 2)
    }
    GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view)
}
function _glUseProgram(program) {
    GLctx.useProgram(GL.programs[program])
}
function _glVertexAttribDivisor(index, divisor) {
    GLctx["vertexAttribDivisor"](index, divisor)
}
function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
    GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr)
}
function _glViewport(x0, x1, x2, x3) {
    GLctx["viewport"](x0, x1, x2, x3)
}
function _setTempRet0($i) {
    setTempRet0($i | 0)
}
InternalError = Module["InternalError"] = extendError(Error, "InternalError");
embind_init_charCodes();
BindingError = Module["BindingError"] = extendError(Error, "BindingError");
init_emval();
UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
var GLctx;
var miniTempWebGLFloatBuffersStorage = new Float32Array(288);
for (var i = 0; i < 288; ++i) {
    miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i + 1)
}
var ASSERTIONS = false;
__ATINIT__.push({
    func: function() {
        ___wasm_call_ctors()
    }
});
var asmLibraryArg = {
    "_embind_finalize_value_object": __embind_finalize_value_object,
    "_embind_register_bool": __embind_register_bool,
    "_embind_register_emval": __embind_register_emval,
    "_embind_register_enum": __embind_register_enum,
    "_embind_register_enum_value": __embind_register_enum_value,
    "_embind_register_float": __embind_register_float,
    "_embind_register_function": __embind_register_function,
    "_embind_register_integer": __embind_register_integer,
    "_embind_register_memory_view": __embind_register_memory_view,
    "_embind_register_std_string": __embind_register_std_string,
    "_embind_register_std_wstring": __embind_register_std_wstring,
    "_embind_register_value_object": __embind_register_value_object,
    "_embind_register_value_object_field": __embind_register_value_object_field,
    "_embind_register_void": __embind_register_void,
    "abort": _abort,
    "emscripten_get_device_pixel_ratio": _emscripten_get_device_pixel_ratio,
    "emscripten_get_element_css_size": _emscripten_get_element_css_size,
    "emscripten_memcpy_big": _emscripten_memcpy_big,
    "emscripten_request_animation_frame_loop": _emscripten_request_animation_frame_loop,
    "emscripten_resize_heap": _emscripten_resize_heap,
    "emscripten_run_script": _emscripten_run_script,
    "emscripten_set_canvas_element_size": _emscripten_set_canvas_element_size,
    "emscripten_set_keydown_callback_on_thread": _emscripten_set_keydown_callback_on_thread,
    "emscripten_set_keypress_callback_on_thread": _emscripten_set_keypress_callback_on_thread,
    "emscripten_set_keyup_callback_on_thread": _emscripten_set_keyup_callback_on_thread,
    "emscripten_set_mousedown_callback_on_thread": _emscripten_set_mousedown_callback_on_thread,
    "emscripten_set_mouseenter_callback_on_thread": _emscripten_set_mouseenter_callback_on_thread,
    "emscripten_set_mouseleave_callback_on_thread": _emscripten_set_mouseleave_callback_on_thread,
    "emscripten_set_mousemove_callback_on_thread": _emscripten_set_mousemove_callback_on_thread,
    "emscripten_set_mouseup_callback_on_thread": _emscripten_set_mouseup_callback_on_thread,
    "emscripten_set_pointerlockchange_callback_on_thread": _emscripten_set_pointerlockchange_callback_on_thread,
    "emscripten_set_pointerlockerror_callback_on_thread": _emscripten_set_pointerlockerror_callback_on_thread,
    "emscripten_set_resize_callback_on_thread": _emscripten_set_resize_callback_on_thread,
    "emscripten_set_touchcancel_callback_on_thread": _emscripten_set_touchcancel_callback_on_thread,
    "emscripten_set_touchend_callback_on_thread": _emscripten_set_touchend_callback_on_thread,
    "emscripten_set_touchmove_callback_on_thread": _emscripten_set_touchmove_callback_on_thread,
    "emscripten_set_touchstart_callback_on_thread": _emscripten_set_touchstart_callback_on_thread,
    "emscripten_set_webglcontextlost_callback_on_thread": _emscripten_set_webglcontextlost_callback_on_thread,
    "emscripten_set_webglcontextrestored_callback_on_thread": _emscripten_set_webglcontextrestored_callback_on_thread,
    "emscripten_set_wheel_callback_on_thread": _emscripten_set_wheel_callback_on_thread,
    "emscripten_webgl_create_context": _emscripten_webgl_create_context,
    "emscripten_webgl_enable_extension": _emscripten_webgl_enable_extension,
    "emscripten_webgl_init_context_attributes": _emscripten_webgl_init_context_attributes,
    "emscripten_webgl_make_context_current": _emscripten_webgl_make_context_current,
    "fd_write": _fd_write,
    "glActiveTexture": _glActiveTexture,
    "glAttachShader": _glAttachShader,
    "glBindBuffer": _glBindBuffer,
    "glBindFramebuffer": _glBindFramebuffer,
    "glBindRenderbuffer": _glBindRenderbuffer,
    "glBindTexture": _glBindTexture,
    "glBlendColor": _glBlendColor,
    "glBlendEquationSeparate": _glBlendEquationSeparate,
    "glBlendFuncSeparate": _glBlendFuncSeparate,
    "glBufferData": _glBufferData,
    "glBufferSubData": _glBufferSubData,
    "glClear": _glClear,
    "glClearColor": _glClearColor,
    "glClearDepthf": _glClearDepthf,
    "glClearStencil": _glClearStencil,
    "glColorMask": _glColorMask,
    "glCompileShader": _glCompileShader,
    "glCompressedTexImage2D": _glCompressedTexImage2D,
    "glCreateProgram": _glCreateProgram,
    "glCreateShader": _glCreateShader,
    "glCullFace": _glCullFace,
    "glDeleteBuffers": _glDeleteBuffers,
    "glDeleteFramebuffers": _glDeleteFramebuffers,
    "glDeleteProgram": _glDeleteProgram,
    "glDeleteRenderbuffers": _glDeleteRenderbuffers,
    "glDeleteShader": _glDeleteShader,
    "glDeleteTextures": _glDeleteTextures,
    "glDepthFunc": _glDepthFunc,
    "glDepthMask": _glDepthMask,
    "glDisable": _glDisable,
    "glDisableVertexAttribArray": _glDisableVertexAttribArray,
    "glDrawArrays": _glDrawArrays,
    "glDrawArraysInstanced": _glDrawArraysInstanced,
    "glDrawElements": _glDrawElements,
    "glDrawElementsInstanced": _glDrawElementsInstanced,
    "glEnable": _glEnable,
    "glEnableVertexAttribArray": _glEnableVertexAttribArray,
    "glFrontFace": _glFrontFace,
    "glGenBuffers": _glGenBuffers,
    "glGenRenderbuffers": _glGenRenderbuffers,
    "glGenTextures": _glGenTextures,
    "glGetAttribLocation": _glGetAttribLocation,
    "glGetIntegerv": _glGetIntegerv,
    "glGetProgramInfoLog": _glGetProgramInfoLog,
    "glGetProgramiv": _glGetProgramiv,
    "glGetShaderInfoLog": _glGetShaderInfoLog,
    "glGetShaderiv": _glGetShaderiv,
    "glGetString": _glGetString,
    "glGetUniformLocation": _glGetUniformLocation,
    "glLinkProgram": _glLinkProgram,
    "glPolygonOffset": _glPolygonOffset,
    "glRenderbufferStorage": _glRenderbufferStorage,
    "glScissor": _glScissor,
    "glShaderSource": _glShaderSource,
    "glStencilFunc": _glStencilFunc,
    "glStencilFuncSeparate": _glStencilFuncSeparate,
    "glStencilMask": _glStencilMask,
    "glStencilOp": _glStencilOp,
    "glStencilOpSeparate": _glStencilOpSeparate,
    "glTexImage2D": _glTexImage2D,
    "glTexParameteri": _glTexParameteri,
    "glTexSubImage2D": _glTexSubImage2D,
    "glUniform1fv": _glUniform1fv,
    "glUniform1i": _glUniform1i,
    "glUniform2fv": _glUniform2fv,
    "glUniform3fv": _glUniform3fv,
    "glUniform4fv": _glUniform4fv,
    "glUniformMatrix4fv": _glUniformMatrix4fv,
    "glUseProgram": _glUseProgram,
    "glVertexAttribDivisor": _glVertexAttribDivisor,
    "glVertexAttribPointer": _glVertexAttribPointer,
    "glViewport": _glViewport,
    "memory": wasmMemory,
    "sapp_js_add_beforeunload_listener": sapp_js_add_beforeunload_listener,
    "sapp_js_add_clipboard_listener": sapp_js_add_clipboard_listener,
    "sapp_js_add_dragndrop_listeners": sapp_js_add_dragndrop_listeners,
    "sapp_js_create_textfield": sapp_js_create_textfield,
    "sapp_js_dropped_file_size": sapp_js_dropped_file_size,
    "sapp_js_exit_pointerlock": sapp_js_exit_pointerlock,
    "sapp_js_fetch_dropped_file": sapp_js_fetch_dropped_file,
    "sapp_js_focus_textfield": sapp_js_focus_textfield,
    "sapp_js_pointer_init": sapp_js_pointer_init,
    "sapp_js_remove_beforeunload_listener": sapp_js_remove_beforeunload_listener,
    "sapp_js_remove_clipboard_listener": sapp_js_remove_clipboard_listener,
    "sapp_js_remove_dragndrop_listeners": sapp_js_remove_dragndrop_listeners,
    "sapp_js_request_pointerlock": sapp_js_request_pointerlock,
    "sapp_js_unfocus_textfield": sapp_js_unfocus_textfield,
    "sapp_js_write_clipboard": sapp_js_write_clipboard,
    "saudio_js_buffer_frames": saudio_js_buffer_frames,
    "saudio_js_init": saudio_js_init,
    "saudio_js_sample_rate": saudio_js_sample_rate,
    "saudio_js_shutdown": saudio_js_shutdown,
    "setTempRet0": _setTempRet0,
    "sfetch_js_send_get_request": sfetch_js_send_get_request,
    "sfetch_js_send_head_request": sfetch_js_send_head_request,
    "stm_js_perfnow": stm_js_perfnow
};
var asm = createWasm();
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
    return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["__wasm_call_ctors"]).apply(null, arguments)
}
;
var _malloc = Module["_malloc"] = function() {
    return (_malloc = Module["_malloc"] = Module["asm"]["malloc"]).apply(null, arguments)
}
;
var _free = Module["_free"] = function() {
    return (_free = Module["_free"] = Module["asm"]["free"]).apply(null, arguments)
}
;
var _mb_frame_count = Module["_mb_frame_count"] = function() {
    return (_mb_frame_count = Module["_mb_frame_count"] = Module["asm"]["mb_frame_count"]).apply(null, arguments)
}
;
var _mb_frame_time = Module["_mb_frame_time"] = function() {
    return (_mb_frame_time = Module["_mb_frame_time"] = Module["asm"]["mb_frame_time"]).apply(null, arguments)
}
;
var _mb_screen_width = Module["_mb_screen_width"] = function() {
    return (_mb_screen_width = Module["_mb_screen_width"] = Module["asm"]["mb_screen_width"]).apply(null, arguments)
}
;
var _mb_screen_height = Module["_mb_screen_height"] = function() {
    return (_mb_screen_height = Module["_mb_screen_height"] = Module["asm"]["mb_screen_height"]).apply(null, arguments)
}
;
var _mb_dpi_scale = Module["_mb_dpi_scale"] = function() {
    return (_mb_dpi_scale = Module["_mb_dpi_scale"] = Module["asm"]["mb_dpi_scale"]).apply(null, arguments)
}
;
var _mb_create_mesh = Module["_mb_create_mesh"] = function() {
    return (_mb_create_mesh = Module["_mb_create_mesh"] = Module["asm"]["mb_create_mesh"]).apply(null, arguments)
}
;
var _mb_create_material = Module["_mb_create_material"] = function() {
    return (_mb_create_material = Module["_mb_create_material"] = Module["asm"]["mb_create_material"]).apply(null, arguments)
}
;
var _mb_create_texture = Module["_mb_create_texture"] = function() {
    return (_mb_create_texture = Module["_mb_create_texture"] = Module["asm"]["mb_create_texture"]).apply(null, arguments)
}
;
var _mb_draw_mesh = Module["_mb_draw_mesh"] = function() {
    return (_mb_draw_mesh = Module["_mb_draw_mesh"] = Module["asm"]["mb_draw_mesh"]).apply(null, arguments)
}
;
var _mb_intersect_mesh = Module["_mb_intersect_mesh"] = function() {
    return (_mb_intersect_mesh = Module["_mb_intersect_mesh"] = Module["asm"]["mb_intersect_mesh"]).apply(null, arguments)
}
;
var _mb_set_material = Module["_mb_set_material"] = function() {
    return (_mb_set_material = Module["_mb_set_material"] = Module["asm"]["mb_set_material"]).apply(null, arguments)
}
;
var _mb_set_uniform_float = Module["_mb_set_uniform_float"] = function() {
    return (_mb_set_uniform_float = Module["_mb_set_uniform_float"] = Module["asm"]["mb_set_uniform_float"]).apply(null, arguments)
}
;
var _mb_set_uniform_float2 = Module["_mb_set_uniform_float2"] = function() {
    return (_mb_set_uniform_float2 = Module["_mb_set_uniform_float2"] = Module["asm"]["mb_set_uniform_float2"]).apply(null, arguments)
}
;
var _mb_set_uniform_float3 = Module["_mb_set_uniform_float3"] = function() {
    return (_mb_set_uniform_float3 = Module["_mb_set_uniform_float3"] = Module["asm"]["mb_set_uniform_float3"]).apply(null, arguments)
}
;
var _mb_set_uniform_float4 = Module["_mb_set_uniform_float4"] = function() {
    return (_mb_set_uniform_float4 = Module["_mb_set_uniform_float4"] = Module["asm"]["mb_set_uniform_float4"]).apply(null, arguments)
}
;
var _mb_set_texture = Module["_mb_set_texture"] = function() {
    return (_mb_set_texture = Module["_mb_set_texture"] = Module["asm"]["mb_set_texture"]).apply(null, arguments)
}
;
var _mb_set_camera_proj = Module["_mb_set_camera_proj"] = function() {
    return (_mb_set_camera_proj = Module["_mb_set_camera_proj"] = Module["asm"]["mb_set_camera_proj"]).apply(null, arguments)
}
;
var _mb_set_camera_lookat = Module["_mb_set_camera_lookat"] = function() {
    return (_mb_set_camera_lookat = Module["_mb_set_camera_lookat"] = Module["asm"]["mb_set_camera_lookat"]).apply(null, arguments)
}
;
var _mb_create_particle_system = Module["_mb_create_particle_system"] = function() {
    return (_mb_create_particle_system = Module["_mb_create_particle_system"] = Module["asm"]["mb_create_particle_system"]).apply(null, arguments)
}
;
var _mb_spawn_particles = Module["_mb_spawn_particles"] = function() {
    return (_mb_spawn_particles = Module["_mb_spawn_particles"] = Module["asm"]["mb_spawn_particles"]).apply(null, arguments)
}
;
var _mb_set_particle_colour = Module["_mb_set_particle_colour"] = function() {
    return (_mb_set_particle_colour = Module["_mb_set_particle_colour"] = Module["asm"]["mb_set_particle_colour"]).apply(null, arguments)
}
;
var _mb_reset_particles = Module["_mb_reset_particles"] = function() {
    return (_mb_reset_particles = Module["_mb_reset_particles"] = Module["asm"]["mb_reset_particles"]).apply(null, arguments)
}
;
var _mb_update_particles = Module["_mb_update_particles"] = function() {
    return (_mb_update_particles = Module["_mb_update_particles"] = Module["asm"]["mb_update_particles"]).apply(null, arguments)
}
;
var _mb_draw_particles = Module["_mb_draw_particles"] = function() {
    return (_mb_draw_particles = Module["_mb_draw_particles"] = Module["asm"]["mb_draw_particles"]).apply(null, arguments)
}
;
var _mb_ui_create_panel = Module["_mb_ui_create_panel"] = function() {
    return (_mb_ui_create_panel = Module["_mb_ui_create_panel"] = Module["asm"]["mb_ui_create_panel"]).apply(null, arguments)
}
;
var _mb_ui_draw_panel = Module["_mb_ui_draw_panel"] = function() {
    return (_mb_ui_draw_panel = Module["_mb_ui_draw_panel"] = Module["asm"]["mb_ui_draw_panel"]).apply(null, arguments)
}
;
var _mb_ui_draw_image = Module["_mb_ui_draw_image"] = function() {
    return (_mb_ui_draw_image = Module["_mb_ui_draw_image"] = Module["asm"]["mb_ui_draw_image"]).apply(null, arguments)
}
;
var _mb_ui_draw_image_additive = Module["_mb_ui_draw_image_additive"] = function() {
    return (_mb_ui_draw_image_additive = Module["_mb_ui_draw_image_additive"] = Module["asm"]["mb_ui_draw_image_additive"]).apply(null, arguments)
}
;
var _mb_create_font = Module["_mb_create_font"] = function() {
    return (_mb_create_font = Module["_mb_create_font"] = Module["asm"]["mb_create_font"]).apply(null, arguments)
}
;
var _mb_draw_text = Module["_mb_draw_text"] = function() {
    return (_mb_draw_text = Module["_mb_draw_text"] = Module["asm"]["mb_draw_text"]).apply(null, arguments)
}
;
var _mb_key_pressed = Module["_mb_key_pressed"] = function() {
    return (_mb_key_pressed = Module["_mb_key_pressed"] = Module["asm"]["mb_key_pressed"]).apply(null, arguments)
}
;
var _mb_key_released = Module["_mb_key_released"] = function() {
    return (_mb_key_released = Module["_mb_key_released"] = Module["asm"]["mb_key_released"]).apply(null, arguments)
}
;
var _mb_key_held = Module["_mb_key_held"] = function() {
    return (_mb_key_held = Module["_mb_key_held"] = Module["asm"]["mb_key_held"]).apply(null, arguments)
}
;
var _mb_mouse_pressed = Module["_mb_mouse_pressed"] = function() {
    return (_mb_mouse_pressed = Module["_mb_mouse_pressed"] = Module["asm"]["mb_mouse_pressed"]).apply(null, arguments)
}
;
var _mb_mouse_released = Module["_mb_mouse_released"] = function() {
    return (_mb_mouse_released = Module["_mb_mouse_released"] = Module["asm"]["mb_mouse_released"]).apply(null, arguments)
}
;
var _mb_mouse_held = Module["_mb_mouse_held"] = function() {
    return (_mb_mouse_held = Module["_mb_mouse_held"] = Module["asm"]["mb_mouse_held"]).apply(null, arguments)
}
;
var _mb_mouse_pos_x = Module["_mb_mouse_pos_x"] = function() {
    return (_mb_mouse_pos_x = Module["_mb_mouse_pos_x"] = Module["asm"]["mb_mouse_pos_x"]).apply(null, arguments)
}
;
var _mb_mouse_pos_y = Module["_mb_mouse_pos_y"] = function() {
    return (_mb_mouse_pos_y = Module["_mb_mouse_pos_y"] = Module["asm"]["mb_mouse_pos_y"]).apply(null, arguments)
}
;
var _mb_reset_input = Module["_mb_reset_input"] = function() {
    return (_mb_reset_input = Module["_mb_reset_input"] = Module["asm"]["mb_reset_input"]).apply(null, arguments)
}
;
var _mb_random_set_seed = Module["_mb_random_set_seed"] = function() {
    return (_mb_random_set_seed = Module["_mb_random_set_seed"] = Module["asm"]["mb_random_set_seed"]).apply(null, arguments)
}
;
var _mb_random_value01 = Module["_mb_random_value01"] = function() {
    return (_mb_random_value01 = Module["_mb_random_value01"] = Module["asm"]["mb_random_value01"]).apply(null, arguments)
}
;
var __sapp_emsc_notify_keyboard_hidden = Module["__sapp_emsc_notify_keyboard_hidden"] = function() {
    return (__sapp_emsc_notify_keyboard_hidden = Module["__sapp_emsc_notify_keyboard_hidden"] = Module["asm"]["_sapp_emsc_notify_keyboard_hidden"]).apply(null, arguments)
}
;
var __sapp_emsc_onpaste = Module["__sapp_emsc_onpaste"] = function() {
    return (__sapp_emsc_onpaste = Module["__sapp_emsc_onpaste"] = Module["asm"]["_sapp_emsc_onpaste"]).apply(null, arguments)
}
;
var __sapp_html5_get_ask_leave_site = Module["__sapp_html5_get_ask_leave_site"] = function() {
    return (__sapp_html5_get_ask_leave_site = Module["__sapp_html5_get_ask_leave_site"] = Module["asm"]["_sapp_html5_get_ask_leave_site"]).apply(null, arguments)
}
;
var __sapp_emsc_begin_drop = Module["__sapp_emsc_begin_drop"] = function() {
    return (__sapp_emsc_begin_drop = Module["__sapp_emsc_begin_drop"] = Module["asm"]["_sapp_emsc_begin_drop"]).apply(null, arguments)
}
;
var __sapp_emsc_drop = Module["__sapp_emsc_drop"] = function() {
    return (__sapp_emsc_drop = Module["__sapp_emsc_drop"] = Module["asm"]["_sapp_emsc_drop"]).apply(null, arguments)
}
;
var __sapp_emsc_end_drop = Module["__sapp_emsc_end_drop"] = function() {
    return (__sapp_emsc_end_drop = Module["__sapp_emsc_end_drop"] = Module["asm"]["_sapp_emsc_end_drop"]).apply(null, arguments)
}
;
var __sapp_emsc_invoke_fetch_cb = Module["__sapp_emsc_invoke_fetch_cb"] = function() {
    return (__sapp_emsc_invoke_fetch_cb = Module["__sapp_emsc_invoke_fetch_cb"] = Module["asm"]["_sapp_emsc_invoke_fetch_cb"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_create_textfield = Module["___em_js__sapp_js_create_textfield"] = function() {
    return (___em_js__sapp_js_create_textfield = Module["___em_js__sapp_js_create_textfield"] = Module["asm"]["__em_js__sapp_js_create_textfield"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_focus_textfield = Module["___em_js__sapp_js_focus_textfield"] = function() {
    return (___em_js__sapp_js_focus_textfield = Module["___em_js__sapp_js_focus_textfield"] = Module["asm"]["__em_js__sapp_js_focus_textfield"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_unfocus_textfield = Module["___em_js__sapp_js_unfocus_textfield"] = function() {
    return (___em_js__sapp_js_unfocus_textfield = Module["___em_js__sapp_js_unfocus_textfield"] = Module["asm"]["__em_js__sapp_js_unfocus_textfield"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_add_beforeunload_listener = Module["___em_js__sapp_js_add_beforeunload_listener"] = function() {
    return (___em_js__sapp_js_add_beforeunload_listener = Module["___em_js__sapp_js_add_beforeunload_listener"] = Module["asm"]["__em_js__sapp_js_add_beforeunload_listener"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_remove_beforeunload_listener = Module["___em_js__sapp_js_remove_beforeunload_listener"] = function() {
    return (___em_js__sapp_js_remove_beforeunload_listener = Module["___em_js__sapp_js_remove_beforeunload_listener"] = Module["asm"]["__em_js__sapp_js_remove_beforeunload_listener"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_add_clipboard_listener = Module["___em_js__sapp_js_add_clipboard_listener"] = function() {
    return (___em_js__sapp_js_add_clipboard_listener = Module["___em_js__sapp_js_add_clipboard_listener"] = Module["asm"]["__em_js__sapp_js_add_clipboard_listener"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_remove_clipboard_listener = Module["___em_js__sapp_js_remove_clipboard_listener"] = function() {
    return (___em_js__sapp_js_remove_clipboard_listener = Module["___em_js__sapp_js_remove_clipboard_listener"] = Module["asm"]["__em_js__sapp_js_remove_clipboard_listener"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_write_clipboard = Module["___em_js__sapp_js_write_clipboard"] = function() {
    return (___em_js__sapp_js_write_clipboard = Module["___em_js__sapp_js_write_clipboard"] = Module["asm"]["__em_js__sapp_js_write_clipboard"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_add_dragndrop_listeners = Module["___em_js__sapp_js_add_dragndrop_listeners"] = function() {
    return (___em_js__sapp_js_add_dragndrop_listeners = Module["___em_js__sapp_js_add_dragndrop_listeners"] = Module["asm"]["__em_js__sapp_js_add_dragndrop_listeners"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_dropped_file_size = Module["___em_js__sapp_js_dropped_file_size"] = function() {
    return (___em_js__sapp_js_dropped_file_size = Module["___em_js__sapp_js_dropped_file_size"] = Module["asm"]["__em_js__sapp_js_dropped_file_size"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_fetch_dropped_file = Module["___em_js__sapp_js_fetch_dropped_file"] = function() {
    return (___em_js__sapp_js_fetch_dropped_file = Module["___em_js__sapp_js_fetch_dropped_file"] = Module["asm"]["__em_js__sapp_js_fetch_dropped_file"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_remove_dragndrop_listeners = Module["___em_js__sapp_js_remove_dragndrop_listeners"] = function() {
    return (___em_js__sapp_js_remove_dragndrop_listeners = Module["___em_js__sapp_js_remove_dragndrop_listeners"] = Module["asm"]["__em_js__sapp_js_remove_dragndrop_listeners"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_pointer_init = Module["___em_js__sapp_js_pointer_init"] = function() {
    return (___em_js__sapp_js_pointer_init = Module["___em_js__sapp_js_pointer_init"] = Module["asm"]["__em_js__sapp_js_pointer_init"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_request_pointerlock = Module["___em_js__sapp_js_request_pointerlock"] = function() {
    return (___em_js__sapp_js_request_pointerlock = Module["___em_js__sapp_js_request_pointerlock"] = Module["asm"]["__em_js__sapp_js_request_pointerlock"]).apply(null, arguments)
}
;
var ___em_js__sapp_js_exit_pointerlock = Module["___em_js__sapp_js_exit_pointerlock"] = function() {
    return (___em_js__sapp_js_exit_pointerlock = Module["___em_js__sapp_js_exit_pointerlock"] = Module["asm"]["__em_js__sapp_js_exit_pointerlock"]).apply(null, arguments)
}
;
var _main = Module["_main"] = function() {
    return (_main = Module["_main"] = Module["asm"]["main"]).apply(null, arguments)
}
;
var ___em_js__stm_js_perfnow = Module["___em_js__stm_js_perfnow"] = function() {
    return (___em_js__stm_js_perfnow = Module["___em_js__stm_js_perfnow"] = Module["asm"]["__em_js__stm_js_perfnow"]).apply(null, arguments)
}
;
var __saudio_emsc_pull = Module["__saudio_emsc_pull"] = function() {
    return (__saudio_emsc_pull = Module["__saudio_emsc_pull"] = Module["asm"]["_saudio_emsc_pull"]).apply(null, arguments)
}
;
var ___em_js__saudio_js_init = Module["___em_js__saudio_js_init"] = function() {
    return (___em_js__saudio_js_init = Module["___em_js__saudio_js_init"] = Module["asm"]["__em_js__saudio_js_init"]).apply(null, arguments)
}
;
var ___em_js__saudio_js_shutdown = Module["___em_js__saudio_js_shutdown"] = function() {
    return (___em_js__saudio_js_shutdown = Module["___em_js__saudio_js_shutdown"] = Module["asm"]["__em_js__saudio_js_shutdown"]).apply(null, arguments)
}
;
var ___em_js__saudio_js_sample_rate = Module["___em_js__saudio_js_sample_rate"] = function() {
    return (___em_js__saudio_js_sample_rate = Module["___em_js__saudio_js_sample_rate"] = Module["asm"]["__em_js__saudio_js_sample_rate"]).apply(null, arguments)
}
;
var ___em_js__saudio_js_buffer_frames = Module["___em_js__saudio_js_buffer_frames"] = function() {
    return (___em_js__saudio_js_buffer_frames = Module["___em_js__saudio_js_buffer_frames"] = Module["asm"]["__em_js__saudio_js_buffer_frames"]).apply(null, arguments)
}
;
var ___em_js__sfetch_js_send_head_request = Module["___em_js__sfetch_js_send_head_request"] = function() {
    return (___em_js__sfetch_js_send_head_request = Module["___em_js__sfetch_js_send_head_request"] = Module["asm"]["__em_js__sfetch_js_send_head_request"]).apply(null, arguments)
}
;
var ___em_js__sfetch_js_send_get_request = Module["___em_js__sfetch_js_send_get_request"] = function() {
    return (___em_js__sfetch_js_send_get_request = Module["___em_js__sfetch_js_send_get_request"] = Module["asm"]["__em_js__sfetch_js_send_get_request"]).apply(null, arguments)
}
;
var __sfetch_emsc_head_response = Module["__sfetch_emsc_head_response"] = function() {
    return (__sfetch_emsc_head_response = Module["__sfetch_emsc_head_response"] = Module["asm"]["_sfetch_emsc_head_response"]).apply(null, arguments)
}
;
var __sfetch_emsc_get_response = Module["__sfetch_emsc_get_response"] = function() {
    return (__sfetch_emsc_get_response = Module["__sfetch_emsc_get_response"] = Module["asm"]["_sfetch_emsc_get_response"]).apply(null, arguments)
}
;
var __sfetch_emsc_failed_http_status = Module["__sfetch_emsc_failed_http_status"] = function() {
    return (__sfetch_emsc_failed_http_status = Module["__sfetch_emsc_failed_http_status"] = Module["asm"]["_sfetch_emsc_failed_http_status"]).apply(null, arguments)
}
;
var __sfetch_emsc_failed_buffer_too_small = Module["__sfetch_emsc_failed_buffer_too_small"] = function() {
    return (__sfetch_emsc_failed_buffer_too_small = Module["__sfetch_emsc_failed_buffer_too_small"] = Module["asm"]["_sfetch_emsc_failed_buffer_too_small"]).apply(null, arguments)
}
;
var __Z17mb__draw_text_cppiNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE4vec2f6HAlign4vec4 = Module["__Z17mb__draw_text_cppiNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE4vec2f6HAlign4vec4"] = function() {
    return (__Z17mb__draw_text_cppiNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE4vec2f6HAlign4vec4 = Module["__Z17mb__draw_text_cppiNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE4vec2f6HAlign4vec4"] = Module["asm"]["_Z17mb__draw_text_cppiNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE4vec2f6HAlign4vec4"]).apply(null, arguments)
}
;
var ___getTypeName = Module["___getTypeName"] = function() {
    return (___getTypeName = Module["___getTypeName"] = Module["asm"]["__getTypeName"]).apply(null, arguments)
}
;
var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = function() {
    return (___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = Module["asm"]["__embind_register_native_and_builtin_types"]).apply(null, arguments)
}
;
var ___errno_location = Module["___errno_location"] = function() {
    return (___errno_location = Module["___errno_location"] = Module["asm"]["__errno_location"]).apply(null, arguments)
}
;
var stackSave = Module["stackSave"] = function() {
    return (stackSave = Module["stackSave"] = Module["asm"]["stackSave"]).apply(null, arguments)
}
;
var stackRestore = Module["stackRestore"] = function() {
    return (stackRestore = Module["stackRestore"] = Module["asm"]["stackRestore"]).apply(null, arguments)
}
;
var stackAlloc = Module["stackAlloc"] = function() {
    return (stackAlloc = Module["stackAlloc"] = Module["asm"]["stackAlloc"]).apply(null, arguments)
}
;
var dynCall_jiji = Module["dynCall_jiji"] = function() {
    return (dynCall_jiji = Module["dynCall_jiji"] = Module["asm"]["dynCall_jiji"]).apply(null, arguments)
}
;
var __growWasmMemory = Module["__growWasmMemory"] = function() {
    return (__growWasmMemory = Module["__growWasmMemory"] = Module["asm"]["__growWasmMemory"]).apply(null, arguments)
}
;
Module["cwrap"] = cwrap;
var calledRun;
function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status
}
var calledMain = false;
dependenciesFulfilled = function runCaller() {
    if (!calledRun)
        run();
    if (!calledRun)
        dependenciesFulfilled = runCaller
}
;
function callMain(args) {
    var entryFunction = Module["_main"];
    args = args || [];
    var argc = args.length + 1;
    var argv = stackAlloc((argc + 1) * 4);
    HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
    for (var i = 1; i < argc; i++) {
        HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
    }
    HEAP32[(argv >> 2) + argc] = 0;
    try {
        var ret = entryFunction(argc, argv);
        exit(ret, true)
    } catch (e) {
        if (e instanceof ExitStatus) {
            return
        } else if (e == "unwind") {
            noExitRuntime = true;
            return
        } else {
            var toLog = e;
            if (e && typeof e === "object" && e.stack) {
                toLog = [e, e.stack]
            }
            err("exception thrown: " + toLog);
            quit_(1, e)
        }
    } finally {
        calledMain = true
    }
}
function run(args) {
    args = args || arguments_;
    if (runDependencies > 0) {
        return
    }
    preRun();
    if (runDependencies > 0)
        return;
    function doRun() {
        if (calledRun)
            return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT)
            return;
        initRuntime();
        preMain();
        if (Module["onRuntimeInitialized"])
            Module["onRuntimeInitialized"]();
        if (shouldRunNow)
            callMain(args);
        postRun()
    }
    if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function() {
            setTimeout(function() {
                Module["setStatus"]("")
            }, 1);
            doRun()
        }, 1)
    } else {
        doRun()
    }
}
Module["run"] = run;
function exit(status, implicit) {
    if (implicit && noExitRuntime && status === 0) {
        return
    }
    if (noExitRuntime) {} else {
        EXITSTATUS = status;
        exitRuntime();
        if (Module["onExit"])
            Module["onExit"](status);
        ABORT = true
    }
    quit_(status, new ExitStatus(status))
}
if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
        Module["preInit"].pop()()
    }
}
var shouldRunNow = true;
if (Module["noInitialRun"])
    shouldRunNow = false;
noExitRuntime = true;
run();

var MB;

function __mb_API_Init() {
    MB = {
        HAlign: {
            Left: Module.HAlign.Left,
            Center: Module.HAlign.Center,
            Right: Module.HAlign.Right
        },
        VAlign: {
            Top: 0,
            Center: 1,
            Bottom: 2
        },
        Shader: {
            Default3D: 0,
            Sprite: 1
        },
        ShaderStage: {
            Vertex: Module.ShaderStage.Vertex,
            Pixel: Module.ShaderStage.Pixel
        },
        SpawnShape: {
            Sphere: Module.ParticleSpawnShape.Sphere,
            Cone: Module.ParticleSpawnShape.Cone,
            Disc: Module.ParticleSpawnShape.Disc,
            Ring: Module.ParticleSpawnShape.Ring
        },

        FrameCount: Module.cwrap('mb_frame_count', 'number', []),
        FrameTime: Module.cwrap('mb_frame_time', 'number', []),
        ScreenWidth: Module.cwrap('mb_screen_width', 'number', []),
        ScreenHeight: Module.cwrap('mb_screen_height', 'number', []),
        DpiScale: Module.cwrap('mb_dpi_scale', 'number', []),

        SaveObject: function(key, obj) {
            try {
                var str = JSON.stringify(obj);
                localStorage.setItem(key, str);
            } catch (err) {}
        },
        LoadObject: function(key, defaultVal) {
            try {
                var str = localStorage.getItem(key);
                if (str === null)
                    return defaultVal;
                else {
                    var val = JSON.parse(str);
                    if (val == null)
                        return defaultVal;
                    return val;
                }
            } catch (err) {
                return defaultVal;
            }
        },

        CreateMesh: Module.cwrap('mb_create_mesh', 'number', ['string']),
        CreateMaterial: Module.cwrap('mb_create_material', 'number', ['number']),
        CreateTexture: Module.cwrap('mb_create_texture', 'number', ['string']),
        DrawMesh: Module.DrawMesh,
        IntersectMesh: Module.IntersectMesh,
        SetMaterial: Module.cwrap('mb_set_material', null, ['number']),
        SetTexture: Module.cwrap('mb_set_texture', null, ['number', 'number']),
        SetUniformFloat: Module.SetUniformFloat,
        SetUniformFloat2: Module.SetUniformFloat2,
        SetUniformFloat3: Module.SetUniformFloat3,
        SetUniformFloat4: Module.SetUniformFloat4,

        SetCameraProjection: Module.SetCameraProjection,
        SetCameraLookAt: Module.SetCameraLookAt,

        CreateParticleSystem: function(params) {
            params.maxParticles = (params.maxParticles == null) ? 100 : params.maxParticles;
            params.spawnRadius = (params.spawnRadius == null) ? 1.0 : params.spawnRadius;
            params.spawnShape = (params.spawnShape == null) ? Module.ParticleSpawnShape.Sphere : params.spawnShape;
            params.lifetime = (params.lifetime == null) ? {
                x: 1,
                y: 1
            } : params.lifetime;
            params.startSize = (params.startSize == null) ? {
                x: 0.5,
                y: 1
            } : params.startSize;
            params.startSpeed = (params.startSpeed == null) ? {
                x: 15,
                y: 30
            } : params.startSpeed;
            params.rotSpeed = (params.rotSpeed == null) ? {
                x: 120,
                y: 360
            } : params.rotSpeed;
            params.spinSpeed = (params.spinSpeed == null) ? {
                x: 50,
                y: 100
            } : params.spinSpeed;
            params.fadeInEnd = (params.fadeInEnd == null) ? 0.1 : params.fadeInEnd;
            params.fadeOutStart = (params.fadeOutStart == null) ? 0.9 : params.fadeOutStart;
            params.startCol = (params.startCol == null) ? {
                x: 1,
                y: 1,
                z: 1,
                w: 1
            } : params.startCol;
            params.gravity = (params.gravity == null) ? -9.8 : params.gravity;
            params.speedLimit = (params.speedLimit == null) ? 10000 : params.speedLimit;
            params.speedDamping = (params.speedDamping == null) ? 0 : params.speedDamping;
            params.texId = (params.texId == null) ? -1 : params.texId;
            params.faceCamera = (params.faceCamera == null) ? true : params.faceCamera;

            return Module.CreateParticleSystem(params);
        },
        SpawnParticles: function(particles, count, pos, dir) {
            Module.SpawnParticles(particles, count, pos, dir || {
                x: 0,
                y: 0,
                z: 1
            });
        },
        SetParticleColour: Module.SetParticleColour,
        ResetParticles: Module.ResetParticles,
        UpdateParticles: Module.UpdateParticles,
        DrawParticles: Module.DrawParticles,

        CreateUIPanel: Module.CreateUIPanel,
        DrawUIPanel: Module.DrawUIPanel,
        DrawUIImage: Module.DrawUIImage,
        DrawUIImageAdditive: Module.DrawUIImageAdditive,

        CreateFont: Module.cwrap('mb_create_font', 'number', ['string']),
        //DrawText : Module.cwrap('mb_draw_text', null, ['number', 'string', 'number', 'number', 'number']),
        DrawText: Module.DrawText,

        WasKeyPressed: Module.cwrap('mb_key_pressed', 'number', ['string']),
        WasKeyReleased: Module.cwrap('mb_key_released', 'number', ['string']),
        IsKeyHeld: Module.cwrap('mb_key_held', 'number', ['string']),
        WasMousePressed: Module.cwrap('mb_mouse_pressed', 'number', ['number']),
        WasMouseReleased: Module.cwrap('mb_mouse_released', 'number', ['number']),
        IsMouseHeld: Module.cwrap('mb_mouse_held', 'number', ['number']),
        MouseX: Module.cwrap('mb_mouse_pos_x', 'number', []),
        MouseY: Module.cwrap('mb_mouse_pos_y', 'number', []),
        ResetInput: Module.cwrap('mb_reset_input', null, []),

        RandomSetSeed: Module.RandomSetSeed,
        Random01: Module.Random01,

        __audioObjects: [],
        __currentMusic: null,
        __audioVol: 1.0,
        CreateMusic: function(filename) {
            var idx = this.CreateSfx(filename);
            return idx;
        },
        CreateSfx: function(filename) {
            var sound = new Howl({
                src: [filename],
                autoplay: false,
            });
            var idx = this.__audioObjects.length;
            this.__audioObjects.push(sound);
            return idx;
        },
        PlayMusic: function(musicId, volume, loop) {
            if (this.__currentMusic != null) {
                let oldMusic = this.__currentMusic;
                if (oldMusic.state() == "loading")
                    oldMusic.once('play', function() {
                        oldMusic.stop();
                    });
                else
                    oldMusic.stop();
                // fade-out?
            }

            if (musicId < 0 || musicId >= this.__audioObjects.length)
                return;

            this.__currentMusic = this.__audioObjects[musicId];

            volume = volume === undefined ? 1.0 : volume;
            loop = loop === undefined ? true : loop;
            this.PlaySfx(musicId, volume, loop);
        },
        PlaySfx: function(sfxId, volume, loop) {
            if (sfxId < 0 || sfxId >= this.__audioObjects.length) {
                console.log("Warning: Unknown sfx id " + sfxId);
                return;
            }

            volume = volume === undefined ? 1.0 : volume;
            loop = loop === undefined ? false : loop;

            var sound = this.__audioObjects[sfxId];
            sound.loop(loop);
            sound.volume(volume);

            var state = sound.state();
            if (state == "loading")
                sound.once('load', function() {
                    sound.play();
                });
            else if (state == "loaded")
                sound.play();
        },
        PauseMusic: function() {
            if (this.__currentMusic != null)
                this.__currentMusic.pause();
        },
        UnPauseMusic: function() {
            if (this.__currentMusic != null && !this.__currentMusic.playing())
                this.__currentMusic.play();
        },
        IsMusicPlaying: function() {
            return (this.__currentMusic != null && this.__currentMusic.playing());
        },
        SetAudioVolume: function(vol) {
            this.__audioVol = vol;
            Howler.volume(vol);
        },
        GetAudioVolume: function() {
            return this.__audioVol;
        }
    }
}
;
/*! howler.js v2.2.0 | (c) 2013-2020, James Simpson of GoldFire Studios | MIT License | howlerjs.com */
!function() {
    "use strict";
    var e = function() {
        this.init()
    };
    e.prototype = {
        init: function() {
            var e = this || n;
            return e._counter = 1e3,
            e._html5AudioPool = [],
            e.html5PoolSize = 10,
            e._codecs = {},
            e._howls = [],
            e._muted = !1,
            e._volume = 1,
            e._canPlayEvent = "canplaythrough",
            e._navigator = "undefined" != typeof window && window.navigator ? window.navigator : null,
            e.masterGain = null,
            e.noAudio = !1,
            e.usingWebAudio = !0,
            e.autoSuspend = !0,
            e.ctx = null,
            e.autoUnlock = !0,
            e._setup(),
            e
        },
        volume: function(e) {
            var o = this || n;
            if (e = parseFloat(e),
            o.ctx || _(),
            void 0 !== e && e >= 0 && e <= 1) {
                if (o._volume = e,
                o._muted)
                    return o;
                o.usingWebAudio && o.masterGain.gain.setValueAtTime(e, n.ctx.currentTime);
                for (var t = 0; t < o._howls.length; t++)
                    if (!o._howls[t]._webAudio)
                        for (var r = o._howls[t]._getSoundIds(), a = 0; a < r.length; a++) {
                            var u = o._howls[t]._soundById(r[a]);
                            u && u._node && (u._node.volume = u._volume * e)
                        }
                return o
            }
            return o._volume
        },
        mute: function(e) {
            var o = this || n;
            o.ctx || _(),
            o._muted = e,
            o.usingWebAudio && o.masterGain.gain.setValueAtTime(e ? 0 : o._volume, n.ctx.currentTime);
            for (var t = 0; t < o._howls.length; t++)
                if (!o._howls[t]._webAudio)
                    for (var r = o._howls[t]._getSoundIds(), a = 0; a < r.length; a++) {
                        var u = o._howls[t]._soundById(r[a]);
                        u && u._node && (u._node.muted = !!e || u._muted)
                    }
            return o
        },
        stop: function() {
            for (var e = this || n, o = 0; o < e._howls.length; o++)
                e._howls[o].stop();
            return e
        },
        unload: function() {
            for (var e = this || n, o = e._howls.length - 1; o >= 0; o--)
                e._howls[o].unload();
            return e.usingWebAudio && e.ctx && void 0 !== e.ctx.close && (e.ctx.close(),
            e.ctx = null,
            _()),
            e
        },
        codecs: function(e) {
            return (this || n)._codecs[e.replace(/^x-/, "")]
        },
        _setup: function() {
            var e = this || n;
            if (e.state = e.ctx ? e.ctx.state || "suspended" : "suspended",
            e._autoSuspend(),
            !e.usingWebAudio)
                if ("undefined" != typeof Audio)
                    try {
                        var o = new Audio;
                        void 0 === o.oncanplaythrough && (e._canPlayEvent = "canplay")
                    } catch (n) {
                        e.noAudio = !0
                    }
                else
                    e.noAudio = !0;
            try {
                var o = new Audio;
                o.muted && (e.noAudio = !0)
            } catch (e) {}
            return e.noAudio || e._setupCodecs(),
            e
        },
        _setupCodecs: function() {
            var e = this || n
              , o = null;
            try {
                o = "undefined" != typeof Audio ? new Audio : null
            } catch (n) {
                return e
            }
            if (!o || "function" != typeof o.canPlayType)
                return e;
            var t = o.canPlayType("audio/mpeg;").replace(/^no$/, "")
              , r = e._navigator && e._navigator.userAgent.match(/OPR\/([0-6].)/g)
              , a = r && parseInt(r[0].split("/")[1], 10) < 33;
            return e._codecs = {
                mp3: !(a || !t && !o.canPlayType("audio/mp3;").replace(/^no$/, "")),
                mpeg: !!t,
                opus: !!o.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/, ""),
                ogg: !!o.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ""),
                oga: !!o.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ""),
                wav: !!o.canPlayType('audio/wav; codecs="1"').replace(/^no$/, ""),
                aac: !!o.canPlayType("audio/aac;").replace(/^no$/, ""),
                caf: !!o.canPlayType("audio/x-caf;").replace(/^no$/, ""),
                m4a: !!(o.canPlayType("audio/x-m4a;") || o.canPlayType("audio/m4a;") || o.canPlayType("audio/aac;")).replace(/^no$/, ""),
                m4b: !!(o.canPlayType("audio/x-m4b;") || o.canPlayType("audio/m4b;") || o.canPlayType("audio/aac;")).replace(/^no$/, ""),
                mp4: !!(o.canPlayType("audio/x-mp4;") || o.canPlayType("audio/mp4;") || o.canPlayType("audio/aac;")).replace(/^no$/, ""),
                weba: !!o.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, ""),
                webm: !!o.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, ""),
                dolby: !!o.canPlayType('audio/mp4; codecs="ec-3"').replace(/^no$/, ""),
                flac: !!(o.canPlayType("audio/x-flac;") || o.canPlayType("audio/flac;")).replace(/^no$/, "")
            },
            e
        },
        _unlockAudio: function() {
            var e = this || n;
            if (!e._audioUnlocked && e.ctx) {
                e._audioUnlocked = !1,
                e.autoUnlock = !1,
                e._mobileUnloaded || 44100 === e.ctx.sampleRate || (e._mobileUnloaded = !0,
                e.unload()),
                e._scratchBuffer = e.ctx.createBuffer(1, 1, 22050);
                var o = function(n) {
                    for (; e._html5AudioPool.length < e.html5PoolSize; )
                        try {
                            var t = new Audio;
                            t._unlocked = !0,
                            e._releaseHtml5Audio(t)
                        } catch (n) {
                            e.noAudio = !0;
                            break
                        }
                    for (var r = 0; r < e._howls.length; r++)
                        if (!e._howls[r]._webAudio)
                            for (var a = e._howls[r]._getSoundIds(), u = 0; u < a.length; u++) {
                                var i = e._howls[r]._soundById(a[u]);
                                i && i._node && !i._node._unlocked && (i._node._unlocked = !0,
                                i._node.load())
                            }
                    e._autoResume();
                    var d = e.ctx.createBufferSource();
                    d.buffer = e._scratchBuffer,
                    d.connect(e.ctx.destination),
                    void 0 === d.start ? d.noteOn(0) : d.start(0),
                    "function" == typeof e.ctx.resume && e.ctx.resume(),
                    d.onended = function() {
                        d.disconnect(0),
                        e._audioUnlocked = !0,
                        document.removeEventListener("touchstart", o, !0),
                        document.removeEventListener("touchend", o, !0),
                        document.removeEventListener("click", o, !0);
                        for (var n = 0; n < e._howls.length; n++)
                            e._howls[n]._emit("unlock")
                    }
                };
                return document.addEventListener("touchstart", o, !0),
                document.addEventListener("touchend", o, !0),
                document.addEventListener("click", o, !0),
                e
            }
        },
        _obtainHtml5Audio: function() {
            var e = this || n;
            if (e._html5AudioPool.length)
                return e._html5AudioPool.pop();
            var o = (new Audio).play();
            return o && "undefined" != typeof Promise && (o instanceof Promise || "function" == typeof o.then) && o.catch(function() {
                console.warn("HTML5 Audio pool exhausted, returning potentially locked audio object.")
            }),
            new Audio
        },
        _releaseHtml5Audio: function(e) {
            var o = this || n;
            return e._unlocked && o._html5AudioPool.push(e),
            o
        },
        _autoSuspend: function() {
            var e = this;
            if (e.autoSuspend && e.ctx && void 0 !== e.ctx.suspend && n.usingWebAudio) {
                for (var o = 0; o < e._howls.length; o++)
                    if (e._howls[o]._webAudio)
                        for (var t = 0; t < e._howls[o]._sounds.length; t++)
                            if (!e._howls[o]._sounds[t]._paused)
                                return e;
                return e._suspendTimer && clearTimeout(e._suspendTimer),
                e._suspendTimer = setTimeout(function() {
                    if (e.autoSuspend) {
                        e._suspendTimer = null,
                        e.state = "suspending";
                        var n = function() {
                            e.state = "suspended",
                            e._resumeAfterSuspend && (delete e._resumeAfterSuspend,
                            e._autoResume())
                        };
                        e.ctx.suspend().then(n, n)
                    }
                }, 3e4),
                e
            }
        },
        _autoResume: function() {
            var e = this;
            if (e.ctx && void 0 !== e.ctx.resume && n.usingWebAudio)
                return "running" === e.state && "interrupted" !== e.ctx.state && e._suspendTimer ? (clearTimeout(e._suspendTimer),
                e._suspendTimer = null) : "suspended" === e.state || "running" === e.state && "interrupted" === e.ctx.state ? (e.ctx.resume().then(function() {
                    e.state = "running";
                    for (var n = 0; n < e._howls.length; n++)
                        e._howls[n]._emit("resume")
                }),
                e._suspendTimer && (clearTimeout(e._suspendTimer),
                e._suspendTimer = null)) : "suspending" === e.state && (e._resumeAfterSuspend = !0),
                e
        }
    };
    var n = new e
      , o = function(e) {
        var n = this;
        if (!e.src || 0 === e.src.length)
            return void console.error("An array of source files must be passed with any new Howl.");
        n.init(e)
    };
    o.prototype = {
        init: function(e) {
            var o = this;
            return n.ctx || _(),
            o._autoplay = e.autoplay || !1,
            o._format = "string" != typeof e.format ? e.format : [e.format],
            o._html5 = e.html5 || !1,
            o._muted = e.mute || !1,
            o._loop = e.loop || !1,
            o._pool = e.pool || 5,
            o._preload = "boolean" != typeof e.preload && "metadata" !== e.preload || e.preload,
            o._rate = e.rate || 1,
            o._sprite = e.sprite || {},
            o._src = "string" != typeof e.src ? e.src : [e.src],
            o._volume = void 0 !== e.volume ? e.volume : 1,
            o._xhr = {
                method: e.xhr && e.xhr.method ? e.xhr.method : "GET",
                headers: e.xhr && e.xhr.headers ? e.xhr.headers : null,
                withCredentials: !(!e.xhr || !e.xhr.withCredentials) && e.xhr.withCredentials
            },
            o._duration = 0,
            o._state = "unloaded",
            o._sounds = [],
            o._endTimers = {},
            o._queue = [],
            o._playLock = !1,
            o._onend = e.onend ? [{
                fn: e.onend
            }] : [],
            o._onfade = e.onfade ? [{
                fn: e.onfade
            }] : [],
            o._onload = e.onload ? [{
                fn: e.onload
            }] : [],
            o._onloaderror = e.onloaderror ? [{
                fn: e.onloaderror
            }] : [],
            o._onplayerror = e.onplayerror ? [{
                fn: e.onplayerror
            }] : [],
            o._onpause = e.onpause ? [{
                fn: e.onpause
            }] : [],
            o._onplay = e.onplay ? [{
                fn: e.onplay
            }] : [],
            o._onstop = e.onstop ? [{
                fn: e.onstop
            }] : [],
            o._onmute = e.onmute ? [{
                fn: e.onmute
            }] : [],
            o._onvolume = e.onvolume ? [{
                fn: e.onvolume
            }] : [],
            o._onrate = e.onrate ? [{
                fn: e.onrate
            }] : [],
            o._onseek = e.onseek ? [{
                fn: e.onseek
            }] : [],
            o._onunlock = e.onunlock ? [{
                fn: e.onunlock
            }] : [],
            o._onresume = [],
            o._webAudio = n.usingWebAudio && !o._html5,
            void 0 !== n.ctx && n.ctx && n.autoUnlock && n._unlockAudio(),
            n._howls.push(o),
            o._autoplay && o._queue.push({
                event: "play",
                action: function() {
                    o.play()
                }
            }),
            o._preload && "none" !== o._preload && o.load(),
            o
        },
        load: function() {
            var e = this
              , o = null;
            if (n.noAudio)
                return void e._emit("loaderror", null, "No audio support.");
            "string" == typeof e._src && (e._src = [e._src]);
            for (var r = 0; r < e._src.length; r++) {
                var u, i;
                if (e._format && e._format[r])
                    u = e._format[r];
                else {
                    if ("string" != typeof (i = e._src[r])) {
                        e._emit("loaderror", null, "Non-string found in selected audio sources - ignoring.");
                        continue
                    }
                    u = /^data:audio\/([^;,]+);/i.exec(i),
                    u || (u = /\.([^.]+)$/.exec(i.split("?", 1)[0])),
                    u && (u = u[1].toLowerCase())
                }
                if (u || console.warn('No file extension was found. Consider using the "format" property or specify an extension.'),
                u && n.codecs(u)) {
                    o = e._src[r];
                    break
                }
            }
            return o ? (e._src = o,
            e._state = "loading",
            "https:" === window.location.protocol && "http:" === o.slice(0, 5) && (e._html5 = !0,
            e._webAudio = !1),
            new t(e),
            e._webAudio && a(e),
            e) : void e._emit("loaderror", null, "No codec support for selected audio sources.")
        },
        play: function(e, o) {
            var t = this
              , r = null;
            if ("number" == typeof e)
                r = e,
                e = null;
            else {
                if ("string" == typeof e && "loaded" === t._state && !t._sprite[e])
                    return null;
                if (void 0 === e && (e = "__default",
                !t._playLock)) {
                    for (var a = 0, u = 0; u < t._sounds.length; u++)
                        t._sounds[u]._paused && !t._sounds[u]._ended && (a++,
                        r = t._sounds[u]._id);
                    1 === a ? e = null : r = null
                }
            }
            var i = r ? t._soundById(r) : t._inactiveSound();
            if (!i)
                return null;
            if (r && !e && (e = i._sprite || "__default"),
            "loaded" !== t._state) {
                i._sprite = e,
                i._ended = !1;
                var d = i._id;
                return t._queue.push({
                    event: "play",
                    action: function() {
                        t.play(d)
                    }
                }),
                d
            }
            if (r && !i._paused)
                return o || t._loadQueue("play"),
                i._id;
            t._webAudio && n._autoResume();
            var _ = Math.max(0, i._seek > 0 ? i._seek : t._sprite[e][0] / 1e3)
              , s = Math.max(0, (t._sprite[e][0] + t._sprite[e][1]) / 1e3 - _)
              , l = 1e3 * s / Math.abs(i._rate)
              , c = t._sprite[e][0] / 1e3
              , f = (t._sprite[e][0] + t._sprite[e][1]) / 1e3;
            i._sprite = e,
            i._ended = !1;
            var p = function() {
                i._paused = !1,
                i._seek = _,
                i._start = c,
                i._stop = f,
                i._loop = !(!i._loop && !t._sprite[e][2])
            };
            if (_ >= f)
                return void t._ended(i);
            var m = i._node;
            if (t._webAudio) {
                var v = function() {
                    t._playLock = !1,
                    p(),
                    t._refreshBuffer(i);
                    var e = i._muted || t._muted ? 0 : i._volume;
                    m.gain.setValueAtTime(e, n.ctx.currentTime),
                    i._playStart = n.ctx.currentTime,
                    void 0 === m.bufferSource.start ? i._loop ? m.bufferSource.noteGrainOn(0, _, 86400) : m.bufferSource.noteGrainOn(0, _, s) : i._loop ? m.bufferSource.start(0, _, 86400) : m.bufferSource.start(0, _, s),
                    l !== 1 / 0 && (t._endTimers[i._id] = setTimeout(t._ended.bind(t, i), l)),
                    o || setTimeout(function() {
                        t._emit("play", i._id),
                        t._loadQueue()
                    }, 0)
                };
                "running" === n.state && "interrupted" !== n.ctx.state ? v() : (t._playLock = !0,
                t.once("resume", v),
                t._clearTimer(i._id))
            } else {
                var h = function() {
                    m.currentTime = _,
                    m.muted = i._muted || t._muted || n._muted || m.muted,
                    m.volume = i._volume * n.volume(),
                    m.playbackRate = i._rate;
                    try {
                        var r = m.play();
                        if (r && "undefined" != typeof Promise && (r instanceof Promise || "function" == typeof r.then) ? (t._playLock = !0,
                        p(),
                        r.then(function() {
                            t._playLock = !1,
                            m._unlocked = !0,
                            o || (t._emit("play", i._id),
                            t._loadQueue())
                        }).catch(function() {
                            t._playLock = !1,
                            t._emit("playerror", i._id, "Playback was unable to start. This is most commonly an issue on mobile devices and Chrome where playback was not within a user interaction."),
                            i._ended = !0,
                            i._paused = !0
                        })) : o || (t._playLock = !1,
                        p(),
                        t._emit("play", i._id),
                        t._loadQueue()),
                        m.playbackRate = i._rate,
                        m.paused)
                            return void t._emit("playerror", i._id, "Playback was unable to start. This is most commonly an issue on mobile devices and Chrome where playback was not within a user interaction.");
                        "__default" !== e || i._loop ? t._endTimers[i._id] = setTimeout(t._ended.bind(t, i), l) : (t._endTimers[i._id] = function() {
                            t._ended(i),
                            m.removeEventListener("ended", t._endTimers[i._id], !1)
                        }
                        ,
                        m.addEventListener("ended", t._endTimers[i._id], !1))
                    } catch (e) {
                        t._emit("playerror", i._id, e)
                    }
                };
                "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA" === m.src && (m.src = t._src,
                m.load());
                var y = window && window.ejecta || !m.readyState && n._navigator.isCocoonJS;
                if (m.readyState >= 3 || y)
                    h();
                else {
                    t._playLock = !0;
                    var g = function() {
                        h(),
                        m.removeEventListener(n._canPlayEvent, g, !1)
                    };
                    m.addEventListener(n._canPlayEvent, g, !1),
                    t._clearTimer(i._id)
                }
            }
            return i._id
        },
        pause: function(e) {
            var n = this;
            if ("loaded" !== n._state || n._playLock)
                return n._queue.push({
                    event: "pause",
                    action: function() {
                        n.pause(e)
                    }
                }),
                n;
            for (var o = n._getSoundIds(e), t = 0; t < o.length; t++) {
                n._clearTimer(o[t]);
                var r = n._soundById(o[t]);
                if (r && !r._paused && (r._seek = n.seek(o[t]),
                r._rateSeek = 0,
                r._paused = !0,
                n._stopFade(o[t]),
                r._node))
                    if (n._webAudio) {
                        if (!r._node.bufferSource)
                            continue;
                        void 0 === r._node.bufferSource.stop ? r._node.bufferSource.noteOff(0) : r._node.bufferSource.stop(0),
                        n._cleanBuffer(r._node)
                    } else
                        isNaN(r._node.duration) && r._node.duration !== 1 / 0 || r._node.pause();
                arguments[1] || n._emit("pause", r ? r._id : null)
            }
            return n
        },
        stop: function(e, n) {
            var o = this;
            if ("loaded" !== o._state || o._playLock)
                return o._queue.push({
                    event: "stop",
                    action: function() {
                        o.stop(e)
                    }
                }),
                o;
            for (var t = o._getSoundIds(e), r = 0; r < t.length; r++) {
                o._clearTimer(t[r]);
                var a = o._soundById(t[r]);
                a && (a._seek = a._start || 0,
                a._rateSeek = 0,
                a._paused = !0,
                a._ended = !0,
                o._stopFade(t[r]),
                a._node && (o._webAudio ? a._node.bufferSource && (void 0 === a._node.bufferSource.stop ? a._node.bufferSource.noteOff(0) : a._node.bufferSource.stop(0),
                o._cleanBuffer(a._node)) : isNaN(a._node.duration) && a._node.duration !== 1 / 0 || (a._node.currentTime = a._start || 0,
                a._node.pause(),
                a._node.duration === 1 / 0 && o._clearSound(a._node))),
                n || o._emit("stop", a._id))
            }
            return o
        },
        mute: function(e, o) {
            var t = this;
            if ("loaded" !== t._state || t._playLock)
                return t._queue.push({
                    event: "mute",
                    action: function() {
                        t.mute(e, o)
                    }
                }),
                t;
            if (void 0 === o) {
                if ("boolean" != typeof e)
                    return t._muted;
                t._muted = e
            }
            for (var r = t._getSoundIds(o), a = 0; a < r.length; a++) {
                var u = t._soundById(r[a]);
                u && (u._muted = e,
                u._interval && t._stopFade(u._id),
                t._webAudio && u._node ? u._node.gain.setValueAtTime(e ? 0 : u._volume, n.ctx.currentTime) : u._node && (u._node.muted = !!n._muted || e),
                t._emit("mute", u._id))
            }
            return t
        },
        volume: function() {
            var e, o, t = this, r = arguments;
            if (0 === r.length)
                return t._volume;
            if (1 === r.length || 2 === r.length && void 0 === r[1]) {
                t._getSoundIds().indexOf(r[0]) >= 0 ? o = parseInt(r[0], 10) : e = parseFloat(r[0])
            } else
                r.length >= 2 && (e = parseFloat(r[0]),
                o = parseInt(r[1], 10));
            var a;
            if (!(void 0 !== e && e >= 0 && e <= 1))
                return a = o ? t._soundById(o) : t._sounds[0],
                a ? a._volume : 0;
            if ("loaded" !== t._state || t._playLock)
                return t._queue.push({
                    event: "volume",
                    action: function() {
                        t.volume.apply(t, r)
                    }
                }),
                t;
            void 0 === o && (t._volume = e),
            o = t._getSoundIds(o);
            for (var u = 0; u < o.length; u++)
                (a = t._soundById(o[u])) && (a._volume = e,
                r[2] || t._stopFade(o[u]),
                t._webAudio && a._node && !a._muted ? a._node.gain.setValueAtTime(e, n.ctx.currentTime) : a._node && !a._muted && (a._node.volume = e * n.volume()),
                t._emit("volume", a._id));
            return t
        },
        fade: function(e, o, t, r) {
            var a = this;
            if ("loaded" !== a._state || a._playLock)
                return a._queue.push({
                    event: "fade",
                    action: function() {
                        a.fade(e, o, t, r)
                    }
                }),
                a;
            e = Math.min(Math.max(0, parseFloat(e)), 1),
            o = Math.min(Math.max(0, parseFloat(o)), 1),
            t = parseFloat(t),
            a.volume(e, r);
            for (var u = a._getSoundIds(r), i = 0; i < u.length; i++) {
                var d = a._soundById(u[i]);
                if (d) {
                    if (r || a._stopFade(u[i]),
                    a._webAudio && !d._muted) {
                        var _ = n.ctx.currentTime
                          , s = _ + t / 1e3;
                        d._volume = e,
                        d._node.gain.setValueAtTime(e, _),
                        d._node.gain.linearRampToValueAtTime(o, s)
                    }
                    a._startFadeInterval(d, e, o, t, u[i], void 0 === r)
                }
            }
            return a
        },
        _startFadeInterval: function(e, n, o, t, r, a) {
            var u = this
              , i = n
              , d = o - n
              , _ = Math.abs(d / .01)
              , s = Math.max(4, _ > 0 ? t / _ : t)
              , l = Date.now();
            e._fadeTo = o,
            e._interval = setInterval(function() {
                var r = (Date.now() - l) / t;
                l = Date.now(),
                i += d * r,
                i = d < 0 ? Math.max(o, i) : Math.min(o, i),
                i = Math.round(100 * i) / 100,
                u._webAudio ? e._volume = i : u.volume(i, e._id, !0),
                a && (u._volume = i),
                (o < n && i <= o || o > n && i >= o) && (clearInterval(e._interval),
                e._interval = null,
                e._fadeTo = null,
                u.volume(o, e._id),
                u._emit("fade", e._id))
            }, s)
        },
        _stopFade: function(e) {
            var o = this
              , t = o._soundById(e);
            return t && t._interval && (o._webAudio && t._node.gain.cancelScheduledValues(n.ctx.currentTime),
            clearInterval(t._interval),
            t._interval = null,
            o.volume(t._fadeTo, e),
            t._fadeTo = null,
            o._emit("fade", e)),
            o
        },
        loop: function() {
            var e, n, o, t = this, r = arguments;
            if (0 === r.length)
                return t._loop;
            if (1 === r.length) {
                if ("boolean" != typeof r[0])
                    return !!(o = t._soundById(parseInt(r[0], 10))) && o._loop;
                e = r[0],
                t._loop = e
            } else
                2 === r.length && (e = r[0],
                n = parseInt(r[1], 10));
            for (var a = t._getSoundIds(n), u = 0; u < a.length; u++)
                (o = t._soundById(a[u])) && (o._loop = e,
                t._webAudio && o._node && o._node.bufferSource && (o._node.bufferSource.loop = e,
                e && (o._node.bufferSource.loopStart = o._start || 0,
                o._node.bufferSource.loopEnd = o._stop)));
            return t
        },
        rate: function() {
            var e, o, t = this, r = arguments;
            if (0 === r.length)
                o = t._sounds[0]._id;
            else if (1 === r.length) {
                var a = t._getSoundIds()
                  , u = a.indexOf(r[0]);
                u >= 0 ? o = parseInt(r[0], 10) : e = parseFloat(r[0])
            } else
                2 === r.length && (e = parseFloat(r[0]),
                o = parseInt(r[1], 10));
            var i;
            if ("number" != typeof e)
                return i = t._soundById(o),
                i ? i._rate : t._rate;
            if ("loaded" !== t._state || t._playLock)
                return t._queue.push({
                    event: "rate",
                    action: function() {
                        t.rate.apply(t, r)
                    }
                }),
                t;
            void 0 === o && (t._rate = e),
            o = t._getSoundIds(o);
            for (var d = 0; d < o.length; d++)
                if (i = t._soundById(o[d])) {
                    t.playing(o[d]) && (i._rateSeek = t.seek(o[d]),
                    i._playStart = t._webAudio ? n.ctx.currentTime : i._playStart),
                    i._rate = e,
                    t._webAudio && i._node && i._node.bufferSource ? i._node.bufferSource.playbackRate.setValueAtTime(e, n.ctx.currentTime) : i._node && (i._node.playbackRate = e);
                    var _ = t.seek(o[d])
                      , s = (t._sprite[i._sprite][0] + t._sprite[i._sprite][1]) / 1e3 - _
                      , l = 1e3 * s / Math.abs(i._rate);
                    !t._endTimers[o[d]] && i._paused || (t._clearTimer(o[d]),
                    t._endTimers[o[d]] = setTimeout(t._ended.bind(t, i), l)),
                    t._emit("rate", i._id)
                }
            return t
        },
        seek: function() {
            var e, o, t = this, r = arguments;
            if (0 === r.length)
                o = t._sounds[0]._id;
            else if (1 === r.length) {
                var a = t._getSoundIds()
                  , u = a.indexOf(r[0]);
                u >= 0 ? o = parseInt(r[0], 10) : t._sounds.length && (o = t._sounds[0]._id,
                e = parseFloat(r[0]))
            } else
                2 === r.length && (e = parseFloat(r[0]),
                o = parseInt(r[1], 10));
            if (void 0 === o)
                return t;
            if ("loaded" !== t._state || t._playLock)
                return t._queue.push({
                    event: "seek",
                    action: function() {
                        t.seek.apply(t, r)
                    }
                }),
                t;
            var i = t._soundById(o);
            if (i) {
                if (!("number" == typeof e && e >= 0)) {
                    if (t._webAudio) {
                        var d = t.playing(o) ? n.ctx.currentTime - i._playStart : 0
                          , _ = i._rateSeek ? i._rateSeek - i._seek : 0;
                        return i._seek + (_ + d * Math.abs(i._rate))
                    }
                    return i._node.currentTime
                }
                var s = t.playing(o);
                s && t.pause(o, !0),
                i._seek = e,
                i._ended = !1,
                t._clearTimer(o),
                t._webAudio || !i._node || isNaN(i._node.duration) || (i._node.currentTime = e);
                var l = function() {
                    t._emit("seek", o),
                    s && t.play(o, !0)
                };
                if (s && !t._webAudio) {
                    var c = function() {
                        t._playLock ? setTimeout(c, 0) : l()
                    };
                    setTimeout(c, 0)
                } else
                    l()
            }
            return t
        },
        playing: function(e) {
            var n = this;
            if ("number" == typeof e) {
                var o = n._soundById(e);
                return !!o && !o._paused
            }
            for (var t = 0; t < n._sounds.length; t++)
                if (!n._sounds[t]._paused)
                    return !0;
            return !1
        },
        duration: function(e) {
            var n = this
              , o = n._duration
              , t = n._soundById(e);
            return t && (o = n._sprite[t._sprite][1] / 1e3),
            o
        },
        state: function() {
            return this._state
        },
        unload: function() {
            for (var e = this, o = e._sounds, t = 0; t < o.length; t++)
                o[t]._paused || e.stop(o[t]._id),
                e._webAudio || (e._clearSound(o[t]._node),
                o[t]._node.removeEventListener("error", o[t]._errorFn, !1),
                o[t]._node.removeEventListener(n._canPlayEvent, o[t]._loadFn, !1),
                n._releaseHtml5Audio(o[t]._node)),
                delete o[t]._node,
                e._clearTimer(o[t]._id);
            var a = n._howls.indexOf(e);
            a >= 0 && n._howls.splice(a, 1);
            var u = !0;
            for (t = 0; t < n._howls.length; t++)
                if (n._howls[t]._src === e._src || e._src.indexOf(n._howls[t]._src) >= 0) {
                    u = !1;
                    break
                }
            return r && u && delete r[e._src],
            n.noAudio = !1,
            e._state = "unloaded",
            e._sounds = [],
            e = null,
            null
        },
        on: function(e, n, o, t) {
            var r = this
              , a = r["_on" + e];
            return "function" == typeof n && a.push(t ? {
                id: o,
                fn: n,
                once: t
            } : {
                id: o,
                fn: n
            }),
            r
        },
        off: function(e, n, o) {
            var t = this
              , r = t["_on" + e]
              , a = 0;
            if ("number" == typeof n && (o = n,
            n = null),
            n || o)
                for (a = 0; a < r.length; a++) {
                    var u = o === r[a].id;
                    if (n === r[a].fn && u || !n && u) {
                        r.splice(a, 1);
                        break
                    }
                }
            else if (e)
                t["_on" + e] = [];
            else {
                var i = Object.keys(t);
                for (a = 0; a < i.length; a++)
                    0 === i[a].indexOf("_on") && Array.isArray(t[i[a]]) && (t[i[a]] = [])
            }
            return t
        },
        once: function(e, n, o) {
            var t = this;
            return t.on(e, n, o, 1),
            t
        },
        _emit: function(e, n, o) {
            for (var t = this, r = t["_on" + e], a = r.length - 1; a >= 0; a--)
                r[a].id && r[a].id !== n && "load" !== e || (setTimeout(function(e) {
                    e.call(this, n, o)
                }
                .bind(t, r[a].fn), 0),
                r[a].once && t.off(e, r[a].fn, r[a].id));
            return t._loadQueue(e),
            t
        },
        _loadQueue: function(e) {
            var n = this;
            if (n._queue.length > 0) {
                var o = n._queue[0];
                o.event === e && (n._queue.shift(),
                n._loadQueue()),
                e || o.action()
            }
            return n
        },
        _ended: function(e) {
            var o = this
              , t = e._sprite;
            if (!o._webAudio && e._node && !e._node.paused && !e._node.ended && e._node.currentTime < e._stop)
                return setTimeout(o._ended.bind(o, e), 100),
                o;
            var r = !(!e._loop && !o._sprite[t][2]);
            if (o._emit("end", e._id),
            !o._webAudio && r && o.stop(e._id, !0).play(e._id),
            o._webAudio && r) {
                o._emit("play", e._id),
                e._seek = e._start || 0,
                e._rateSeek = 0,
                e._playStart = n.ctx.currentTime;
                var a = 1e3 * (e._stop - e._start) / Math.abs(e._rate);
                o._endTimers[e._id] = setTimeout(o._ended.bind(o, e), a)
            }
            return o._webAudio && !r && (e._paused = !0,
            e._ended = !0,
            e._seek = e._start || 0,
            e._rateSeek = 0,
            o._clearTimer(e._id),
            o._cleanBuffer(e._node),
            n._autoSuspend()),
            o._webAudio || r || o.stop(e._id, !0),
            o
        },
        _clearTimer: function(e) {
            var n = this;
            if (n._endTimers[e]) {
                if ("function" != typeof n._endTimers[e])
                    clearTimeout(n._endTimers[e]);
                else {
                    var o = n._soundById(e);
                    o && o._node && o._node.removeEventListener("ended", n._endTimers[e], !1)
                }
                delete n._endTimers[e]
            }
            return n
        },
        _soundById: function(e) {
            for (var n = this, o = 0; o < n._sounds.length; o++)
                if (e === n._sounds[o]._id)
                    return n._sounds[o];
            return null
        },
        _inactiveSound: function() {
            var e = this;
            e._drain();
            for (var n = 0; n < e._sounds.length; n++)
                if (e._sounds[n]._ended)
                    return e._sounds[n].reset();
            return new t(e)
        },
        _drain: function() {
            var e = this
              , n = e._pool
              , o = 0
              , t = 0;
            if (!(e._sounds.length < n)) {
                for (t = 0; t < e._sounds.length; t++)
                    e._sounds[t]._ended && o++;
                for (t = e._sounds.length - 1; t >= 0; t--) {
                    if (o <= n)
                        return;
                    e._sounds[t]._ended && (e._webAudio && e._sounds[t]._node && e._sounds[t]._node.disconnect(0),
                    e._sounds.splice(t, 1),
                    o--)
                }
            }
        },
        _getSoundIds: function(e) {
            var n = this;
            if (void 0 === e) {
                for (var o = [], t = 0; t < n._sounds.length; t++)
                    o.push(n._sounds[t]._id);
                return o
            }
            return [e]
        },
        _refreshBuffer: function(e) {
            var o = this;
            return e._node.bufferSource = n.ctx.createBufferSource(),
            e._node.bufferSource.buffer = r[o._src],
            e._panner ? e._node.bufferSource.connect(e._panner) : e._node.bufferSource.connect(e._node),
            e._node.bufferSource.loop = e._loop,
            e._loop && (e._node.bufferSource.loopStart = e._start || 0,
            e._node.bufferSource.loopEnd = e._stop || 0),
            e._node.bufferSource.playbackRate.setValueAtTime(e._rate, n.ctx.currentTime),
            o
        },
        _cleanBuffer: function(e) {
            var o = this
              , t = n._navigator && n._navigator.vendor.indexOf("Apple") >= 0;
            if (n._scratchBuffer && e.bufferSource && (e.bufferSource.onended = null,
            e.bufferSource.disconnect(0),
            t))
                try {
                    e.bufferSource.buffer = n._scratchBuffer
                } catch (e) {}
            return e.bufferSource = null,
            o
        },
        _clearSound: function(e) {
            /MSIE |Trident\//.test(n._navigator && n._navigator.userAgent) || (e.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA")
        }
    };
    var t = function(e) {
        this._parent = e,
        this.init()
    };
    t.prototype = {
        init: function() {
            var e = this
              , o = e._parent;
            return e._muted = o._muted,
            e._loop = o._loop,
            e._volume = o._volume,
            e._rate = o._rate,
            e._seek = 0,
            e._paused = !0,
            e._ended = !0,
            e._sprite = "__default",
            e._id = ++n._counter,
            o._sounds.push(e),
            e.create(),
            e
        },
        create: function() {
            var e = this
              , o = e._parent
              , t = n._muted || e._muted || e._parent._muted ? 0 : e._volume;
            return o._webAudio ? (e._node = void 0 === n.ctx.createGain ? n.ctx.createGainNode() : n.ctx.createGain(),
            e._node.gain.setValueAtTime(t, n.ctx.currentTime),
            e._node.paused = !0,
            e._node.connect(n.masterGain)) : n.noAudio || (e._node = n._obtainHtml5Audio(),
            e._errorFn = e._errorListener.bind(e),
            e._node.addEventListener("error", e._errorFn, !1),
            e._loadFn = e._loadListener.bind(e),
            e._node.addEventListener(n._canPlayEvent, e._loadFn, !1),
            e._node.src = o._src,
            e._node.preload = !0 === o._preload ? "auto" : o._preload,
            e._node.volume = t * n.volume(),
            e._node.load()),
            e
        },
        reset: function() {
            var e = this
              , o = e._parent;
            return e._muted = o._muted,
            e._loop = o._loop,
            e._volume = o._volume,
            e._rate = o._rate,
            e._seek = 0,
            e._rateSeek = 0,
            e._paused = !0,
            e._ended = !0,
            e._sprite = "__default",
            e._id = ++n._counter,
            e
        },
        _errorListener: function() {
            var e = this;
            e._parent._emit("loaderror", e._id, e._node.error ? e._node.error.code : 0),
            e._node.removeEventListener("error", e._errorFn, !1)
        },
        _loadListener: function() {
            var e = this
              , o = e._parent;
            o._duration = Math.ceil(10 * e._node.duration) / 10,
            0 === Object.keys(o._sprite).length && (o._sprite = {
                __default: [0, 1e3 * o._duration]
            }),
            "loaded" !== o._state && (o._state = "loaded",
            o._emit("load"),
            o._loadQueue()),
            e._node.removeEventListener(n._canPlayEvent, e._loadFn, !1)
        }
    };
    var r = {}
      , a = function(e) {
        var n = e._src;
        if (r[n])
            return e._duration = r[n].duration,
            void d(e);
        if (/^data:[^;]+;base64,/.test(n)) {
            for (var o = atob(n.split(",")[1]), t = new Uint8Array(o.length), a = 0; a < o.length; ++a)
                t[a] = o.charCodeAt(a);
            i(t.buffer, e)
        } else {
            var _ = new XMLHttpRequest;
            _.open(e._xhr.method, n, !0),
            _.withCredentials = e._xhr.withCredentials,
            _.responseType = "arraybuffer",
            e._xhr.headers && Object.keys(e._xhr.headers).forEach(function(n) {
                _.setRequestHeader(n, e._xhr.headers[n])
            }),
            _.onload = function() {
                var n = (_.status + "")[0];
                if ("0" !== n && "2" !== n && "3" !== n)
                    return void e._emit("loaderror", null, "Failed loading audio file with status: " + _.status + ".");
                i(_.response, e)
            }
            ,
            _.onerror = function() {
                e._webAudio && (e._html5 = !0,
                e._webAudio = !1,
                e._sounds = [],
                delete r[n],
                e.load())
            }
            ,
            u(_)
        }
    }
      , u = function(e) {
        try {
            e.send()
        } catch (n) {
            e.onerror()
        }
    }
      , i = function(e, o) {
        var t = function() {
            o._emit("loaderror", null, "Decoding audio data failed.")
        }
          , a = function(e) {
            e && o._sounds.length > 0 ? (r[o._src] = e,
            d(o, e)) : t()
        };
        "undefined" != typeof Promise && 1 === n.ctx.decodeAudioData.length ? n.ctx.decodeAudioData(e).then(a).catch(t) : n.ctx.decodeAudioData(e, a, t)
    }
      , d = function(e, n) {
        n && !e._duration && (e._duration = n.duration),
        0 === Object.keys(e._sprite).length && (e._sprite = {
            __default: [0, 1e3 * e._duration]
        }),
        "loaded" !== e._state && (e._state = "loaded",
        e._emit("load"),
        e._loadQueue())
    }
      , _ = function() {
        if (n.usingWebAudio) {
            try {
                "undefined" != typeof AudioContext ? n.ctx = new AudioContext : "undefined" != typeof webkitAudioContext ? n.ctx = new webkitAudioContext : n.usingWebAudio = !1
            } catch (e) {
                n.usingWebAudio = !1
            }
            n.ctx || (n.usingWebAudio = !1);
            var e = /iP(hone|od|ad)/.test(n._navigator && n._navigator.platform)
              , o = n._navigator && n._navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/)
              , t = o ? parseInt(o[1], 10) : null;
            if (e && t && t < 9) {
                var r = /safari/.test(n._navigator && n._navigator.userAgent.toLowerCase());
                n._navigator && !r && (n.usingWebAudio = !1)
            }
            n.usingWebAudio && (n.masterGain = void 0 === n.ctx.createGain ? n.ctx.createGainNode() : n.ctx.createGain(),
            n.masterGain.gain.setValueAtTime(n._muted ? 0 : n._volume, n.ctx.currentTime),
            n.masterGain.connect(n.ctx.destination)),
            n._setup()
        }
    };
    "function" == typeof define && define.amd && define([], function() {
        return {
            Howler: n,
            Howl: o
        }
    }),
    "undefined" != typeof exports && (exports.Howler = n,
    exports.Howl = o),
    "undefined" != typeof global ? (global.HowlerGlobal = e,
    global.Howler = n,
    global.Howl = o,
    global.Sound = t) : "undefined" != typeof window && (window.HowlerGlobal = e,
    window.Howler = n,
    window.Howl = o,
    window.Sound = t)
}();
