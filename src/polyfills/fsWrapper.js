console.warn("FS Polyfill is being used in the browser.");

const storageKey = "fsWrapper";

// Load storage from localStorage
let storage = {}//JSON.parse(localStorage.getItem(storageKey) || "{}");

// Function to save to localStorage
const saveStorage = () => {
    //localStorage.setItem(storageKey, JSON.stringify(storageProxy));
};

// Create a proxy that automatically updates `window.fsWrapperStorage` and `localStorage`
const handler = {
    subscribers: [],
    get(target, key) {
        handler.subscribers.forEach(callback => callback('get', key, target[key]));
        return target[key];
    },


    set(target, key, value) {
        target[key] = value;
        saveStorage();
        self.fsWrapperStorage = target; // Ensure it stays in sync
        handler.subscribers.forEach(callback => callback('set', key, value));
        return true;
    },

    deleteProperty(target, key) {
        if (key in target) {
            delete target[key];
            saveStorage();
            self.fsWrapperStorage = target;
            handler.subscribers.forEach(callback => callback('delete', key));
            return true;
        }
        return false;
    },

    subscribe(callback) {
        handler.subscribers.push(callback);
    }
};

const storageProxy = new Proxy(storage, handler);

// Update global reference
self.fsWrapperStorage = storageProxy;
self.fsWrapperStorage.subscribe = handler.subscribe;

let inputBuffer = [];

const inputBufferHandler = {
    subscribers: [],

    get(target, key) {
        if (typeof target[key] === "function") {
            return target[key].bind(target);
        }
        inputBufferHandler.subscribers.forEach(callback => callback('get', key, target[key]));
        return target[key];
    },

    set(target, key, value) {
        target[key] = value;
        inputBufferHandler.subscribers.forEach(callback => callback('set', key, value));
        return true;
    },

    apply(target, thisArg, args) {
        if (typeof target === "function") {
            const result = target.apply(thisArg, args);
            inputBufferHandler.subscribers.forEach(callback => callback('apply', target.name, args, result));
            return result;
        }
    },

    push(target, ...items) {
        const result = target.push(...items);
        inputBufferHandler.subscribers.forEach(callback => callback('push', items));
        return result;
    },

    shift(target) {
        const result = target.shift();
        inputBufferHandler.subscribers.forEach(callback => callback('shift', result));
        return result;
    },

    subscribe(callback) {
        inputBufferHandler.subscribers.push(callback);
    }
};



// Proxy for input buffer
const inputBufferProxy = new Proxy(inputBuffer, {
    get(target, key) {
        if (key === "subscribe") return inputBufferHandler.subscribe;
        if (key === "push") return inputBufferHandler.push.bind(null, target);
        if (key === "shift") return inputBufferHandler.shift.bind(null, target);
        return target[key];
    },

    set(target, key, value) {
        target[key] = value;
        inputBufferHandler.subscribers.forEach(callback => callback('set', key, value));
        return true;
    }
});

self.inputBuffer = inputBufferProxy;

// File System Wrapper
const fsWrapper = {
    readFile: (path, encoding, callback) => {
        if (typeof encoding === "function") {
            callback = encoding;
            encoding = "utf8";
        }
        setTimeout(() => {
            if (storageProxy[path]) {
                callback(null, storageProxy[path]);
            } else {
                callback(new Error("File not found"), null);
            }
        }, 10);
    },
    writeFile: (path, data, callback) => {
        setTimeout(() => {
            storageProxy[path] = data;
            callback(null);
        }, 10);
    },
    existsSync: (path) => !!storageProxy[path],
    readdir: (path, callback) => {
        setTimeout(() => callback(null, Object.keys(storageProxy)), 10);
    },
    unlink: (path, callback) => {
        setTimeout(() => {
            delete storageProxy[path];
            callback(null);
        }, 10);
    },
    mkdir: (path, options, callback) => {
        setTimeout(() => callback(null), 10);
    },

    // Synchronous methods
    readdirSync: () => Object.keys(storageProxy),
    writeFileSync: (path, data) => {
        storageProxy[path] = data;
    },
    readFileSync: (path, encoding) => {
        if (storageProxy[path]) {
            if (encoding === "utf-8" || encoding === "utf8") {
                return storageProxy[path];
            }
            return Buffer.from(storageProxy[path].split('').map(char => char.codePointAt(0)));
        }
        throw new Error("File not found");
    },
    statSync: (path) => {
        if (storageProxy[path]) {
            return { size: storageProxy[path].length, isFile: true };
        }
        throw new Error("File not found");
    },
    mkdirSync: () => { },
    copyFileSync: (src, dest) => {
        if (!storageProxy[src]) throw new Error("Source file not found");
        storageProxy[dest] = storageProxy[src];
    },
    unlinkSync: (path) => {
        delete storageProxy[path];
    },
    writeSync: (fd, data) => {
        console.log(fd, data);
        if (fd === 0) { // If it's stdin, write it to the input buffer
            inputBufferProxy.push(data);
        } else {
            if (data instanceof Buffer) {
                data = Array.from(data, byte => String.fromCodePoint(byte)).join('');
            }
            storageProxy[fd] = (storageProxy[fd] || "") + data;
        }
    },
    openSync: (path, flags) => {
        if (!storageProxy[path]) storageProxy[path] = "";
        return path;
    },
    readSync: (fd, buffer, offset, length, position) => {
        if (fd === 0) { // If it's stdin, read from the buffer
            if (inputBufferProxy.length == 0)
                self.waitForInput();
            if (inputBufferProxy.length > 0) {
                let inputByte;
                let bytesRead = 0;
                while( true ) {
                    inputByte = inputBufferProxy.shift()
                    if (inputByte.length == 0) 
                        return bytesRead;

                    buffer.set(Buffer.from([inputByte]), offset + bytesRead);
                    bytesRead += 1;
                    if (bytesRead >= length) 
                        return bytesRead;
                }
            } else { // Call the sleep callback.
                console.error("No input data available even after waiting.");
            }

            return 0;
        }

        const data = storageProxy[fd];
        if (!data) return 0;
        const bytesRead = Math.min(length, data.length - position);
        buffer.set(Buffer.from(data.slice(position, position + bytesRead)), offset);
        return bytesRead;
    },
    closeSync: () => { },
};

export default fsWrapper;
