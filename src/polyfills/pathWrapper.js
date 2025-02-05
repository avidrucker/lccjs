const isNode = typeof window === "undefined";

let pathWrapper;

if (isNode) {
  const path = require("path");
  pathWrapper = {
    extname: path.extname,
    parse: path.parse,
    format: path.format,
    join: path.join,
    dirname: path.dirname,
  };
} else {
  console.warn("Path Polyfill is being used in the browser.");

  pathWrapper = {
    /**
     * Get the file extension from a path.
     */
    extname: (filePath) => {
      const match = filePath.match(/(\.[^.]+)$/);
      return match ? match[0] : "";
    },

    /**
     * Parse a path into an object.
     */
    parse: (filePath) => {
      const parts = filePath.split("/");
      const fileName = parts.pop();
      const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
      return {
        root: parts.length ? "/" : "",
        dir: parts.join("/") || "/",
        base: fileName,
        ext: ext ? `.${ext}` : "",
        name: fileName.replace(/\.[^/.]+$/, ""),
      };
    },

    /**
     * Format a parsed path object back into a string.
     */
    format: ({ root = "", dir = "", base = "", ext = "", name = "" }) => {
      if (!base) {
        base = name + ext;
      }
      return (dir.endsWith("/") ? dir : dir + "/") + base;
    },

    /**
     * Join multiple path segments into one.
     */
    join: (...segments) => {
      return segments
        .map((s, i) => (i > 0 ? s.replace(/^\/+/, "") : s)) // Remove leading slashes
        .join("/")
        .replace(/\/+/g, "/"); // Normalize slashes
    },

    /**
     * Get the directory name of a path.
     */
    dirname: (filePath) => {
      return filePath.substring(0, filePath.lastIndexOf("/")) || "/";
    },
  };
}

module.exports = pathWrapper;
