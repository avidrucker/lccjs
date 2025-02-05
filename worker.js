// worker.js
self.importScripts("dist/bundle.js"); // Load the LCC library

let lcc = new LCC.default();


// Handle messages from the main thread
self.onmessage = function (event) {
    const { type, payload } = event.data;

    if (type === "run") {
        const { code, filePath, name } = payload;

        // get filename from fileName without extension
        const fileName = filePath.split('.').slice(0, -1).join('.');

        console.log(fileName);
        // delete bst, lst, and e files if they exist
        delete self.fsWrapperStorage[fileName + ".bst"];
        delete self.fsWrapperStorage[fileName + ".lst"];
        delete self.fsWrapperStorage[fileName + ".e"];

        // Store the code in the virtual file system
        self.fsWrapperStorage[filePath] = code;

        self.fsWrapperStorage["name.nnn"] = name || "noname";

        // Capture stdout and stderr output
        if(self.process.subscribers.length > 0) {
            self.process.subscribers = [];
        }
        self.process.subscribe((type, data) => {
            if (type === "stdout.write") {
                self.postMessage({ type: "stdout", data });
            } else if (type === "stderr.write") {
                self.postMessage({ type: "stderr", data });
            } else if (type === "exit") {
                self.postMessage({ type: "exit", code: data });
            }
        });

        // Run the LCC compiler
        lcc.main([filePath]);
    }
};
