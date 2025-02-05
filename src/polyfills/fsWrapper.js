let fsWrapper;

console.warn("FS Polyfill is being used in the browser.");

const storageKey = "fsWrapper";
let storage = JSON.parse(localStorage.getItem(storageKey) || "{}");

const saveStorage = () => localStorage.setItem(storageKey, JSON.stringify(storage));

fsWrapper = {
    readFile: (path, encoding, callback) => {
        if (typeof encoding === "function") {
            callback = encoding;
            encoding = "utf8";
        }
        setTimeout(() => {
            if (storage[path]) {
                callback(null, storage[path]);
            } else {
                callback(new Error("File not found"), null);
            }
        }, 10);
    },
    writeFile: (path, data, callback) => {
        setTimeout(() => {
            storage[path] = data;
            saveStorage();
            callback(null);
        }, 10);
    },
    existsSync: (path) => !!storage[path],
    readdir: (path, callback) => {
        setTimeout(() => callback(null, Object.keys(storage)), 10);
    },
    unlink: (path, callback) => {
        setTimeout(() => {
            delete storage[path];
            saveStorage();
            callback(null);
        }, 10);
    },
    mkdir: (path, options, callback) => {
        setTimeout(() => callback(null), 10);
    },

    // Synchronous methods
    readdirSync: () => Object.keys(storage),
    writeFileSync: (path, data) => {
        storage[path] = data;
        saveStorage();
    },
    readFileSync: (path, encoding) => {
        if (storage[path]) {
            // return buffer
            if (encoding === "utf-8" || encoding === "utf8") {
                return storage[path];
            }
            return Buffer.from(storage[path].split('').map(char => char.codePointAt(0)));
        }
        throw new Error("File not found");
    },
    statSync: (path) => {
        if (storage[path]) {
            return { size: storage[path].length, isFile: true };
        }
        throw new Error("File not found");
    },
    mkdirSync: () => { },
    copyFileSync: (src, dest) => {
        if (!storage[src]) throw new Error("Source file not found");
        storage[dest] = storage[src];
        saveStorage();
    },
    unlinkSync: (path) => {
        delete storage[path];
        saveStorage();
    },
    writeSync: (fd, data) => {
      console.log(fd, data);
        if (fd === 0) { // If it's stdin, write it to the input buffer
            inputBuffer.push(data);
        } else {
            // if data is a buffer
            if (data instanceof Buffer) {
                data = Array.from(data, byte => String.fromCodePoint(byte)).join('')
            }
            storage[fd] = (storage[fd] || "") + data;
            saveStorage();
        }
    },
    openSync: (path, flags) => {
        if (!storage[path]) storage[path] = "";
        return path;
    },
    readSync: (fd, buffer, offset, length, position) => {
        if (fd === 0) { // If it's stdin, read from the buffer
            if (inputBuffer.length > 0) {
                let inputData = inputBuffer.shift();
                let bytesRead = Math.min(length, inputData.length);
                buffer.set(Buffer.from(inputData.slice(0, bytesRead)), offset);
                return bytesRead;
            }
            return 0;
        }

        const data = storage[fd];
        if (!data) return 0;
        const bytesRead = Math.min(length, data.length - position);
        buffer.set(Buffer.from(data.slice(position, position + bytesRead)), offset);
        return bytesRead;
    },
    closeSync: () => { },
};

export default fsWrapper;
