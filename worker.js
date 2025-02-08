// worker.js
self.importScripts("dist/bundle.js"); // Load the LCC library

let lcc = new LCC.default();

let inputBuffer;
let inputView;
let inputIndex;
let indexView;

// Function to read input in a blocking manner
self.waitForInput = function waitForInput() {
    while (true) {
        console.log("waitForInput", inputBuffer.length);
        Atomics.wait(indexView, 0, 0); // Sleep until new input arrives

        let length = Atomics.load(indexView, 0);
        console.log("unwait waitForInput", length);
        if (length > 0) {
            let inputCopy = new Uint8Array(length);
            inputCopy.set(inputView.subarray(0, length));
            let inputStr = new TextDecoder().decode(inputCopy);

            console.log("Input:", inputStr);
            self.process.stdout.write(inputStr + "\n");

            // Reset index and allow new input
            Atomics.store(indexView, 0, 0);
        }
    }
}

// Handle messages from the main thread
self.onmessage = function (event) {
    const { type, payload } = event.data;

    if (event.data.inputBuffer && event.data.inputIndex) {
        inputBuffer = event.data.inputBuffer;
        inputView = new Uint8Array(inputBuffer);
        inputIndex = event.data.inputIndex;
        indexView = new Int32Array(inputIndex);

        console.log("Worker received shared buffers.");
    } else if (type === "run") {
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
        if (self.process.subscribers.length > 0) {
            self.process.subscribers = [];
        }
        self.process.subscribe((type, data) => {
            if (type === "stdout.write") {
                self.postMessage({ type: "stdout", data });
            } else if (type === "stderr.write") {
                self.postMessage({ type: "stderr", data });
            } else if (type === "exit") {
                self.postMessage({ type: "exit", code: data });
            } else if (type === "stdin") {
                console.log("stdin", data);
                // Read input from the shared buffer
                let bytesRead = self.fsWrapper.readSync(0, inputView, 0, 256, 0);
                if (bytesRead > 0) {
                    // Update the index to signal new input
                    Atomics.store(indexView, 0, bytesRead);
                    Atomics.notify(indexView, 0, 1);
                    console.log("stdin", bytesRead);
                    self.inputBuffer.push(bytesRead)
                } else {
                    // Wait for more input
                    waitForInput();
                }
            }
        });

        // Run the LCC compiler
        lcc.main([filePath]);
    } else if (type === "stdin") {
        //self.inputBuffer.push(payload)
        console.log("stdin generic", payload);
        //self.process.stdin.readSync();
    }
};
