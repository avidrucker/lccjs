
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

  // Synchronous methods for browser
  readdirSync: () => Object.keys(storage),
  writeFileSync: (path, data) => {
    storage[path] = data;
    saveStorage();
  },
  readFileSync: (path) => {
    if (storage[path]) {
      return storage[path];
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
    storage[fd] = (storage[fd] || "") + data;
    saveStorage();
  },
  openSync: (path, flags) => {
    if (!storage[path]) storage[path] = "";
    return path;
  },
  readSync: (fd, buffer, offset, length, position) => {
    const data = storage[fd];
    if (!data) return 0;
    const bytesRead = Math.min(length, data.length - position);
    buffer.set(data.slice(position, position + bytesRead), offset);
    return bytesRead;
  },
  closeSync: () => { },
};


export default fsWrapper;
