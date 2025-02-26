// worker.js
let randomnumber = Math.floor(Math.random() * 1000000);
self.importScripts("./dist/bundle.js" + "?v=" + randomnumber); // Load the LCC compiler

// Initialize LCC
let lcc;
try {
  if (typeof LCC !== 'undefined') {
    if (typeof LCC.default === 'function') {
      lcc = new LCC.default();
      console.log("LCC initialized with default export");
    } else if (typeof LCC === 'function') {
      lcc = new LCC();
      console.log("LCC initialized directly");
    } else {
      console.error("LCC is not a constructor", typeof LCC);
    }
  } else {
    console.error("LCC is undefined");
  }
} catch (e) {
  console.error("Error initializing LCC:", e);
}

self.isWebWorker = true;

// Shared Memory Buffers
let inputBuffer;
let inputView;
let inputIndex;
let indexView;

// Blocking function to wait for input
self.waitForInput = function waitForInput() {
    while (true) {
        console.log("Waiting for input...", Atomics.load(indexView, 0));
        
        // Block until new input arrives
        Atomics.wait(indexView, 0, 0);

        let length = Atomics.load(indexView, 0);
        console.log("Input received:", length);
        
        if (length > 0) {
            let inputCopy = new Uint8Array(length);
            inputCopy.set(inputView.subarray(0, length));
            let inputStr = new TextDecoder().decode(inputCopy);
            
            for (let i = 0; i < inputCopy.length; i++) {
                self.inputBuffer.push(inputCopy[i]);
            }

            console.log("Input:", inputStr);
            self.process.stdout.write(inputStr + "\n");

            // Reset index for new input
            Atomics.store(indexView, 0, 0);
            break;
        }
    }
};

// Handle messages from the main thread
self.onmessage = function(event) {
    try {
        const { type, payload } = event.data;

        if (event.data.inputBuffer && event.data.inputIndex) {
            inputBuffer = event.data.inputBuffer;
            inputView = new Uint8Array(inputBuffer);
            inputIndex = event.data.inputIndex;
            indexView = new Int32Array(inputIndex);
            console.log("Worker received shared buffers.");
        } else if (type === "stdin-fallback") {
            // Handle input from main thread via fallback
            const input = payload.input;
            console.log("Received input via fallback:", input);

            // Convert input to buffer
            const encoded = new TextEncoder().encode(input + '\n');
            inputView.set(encoded);

            // Notify the waiting thread
            Atomics.store(indexView, 0, encoded.length);
            Atomics.notify(indexView, 0);

        } else if (type === "run") {
            const { code, filePath, name } = payload;

            // Extract filename without extension
            const fileName = filePath.split('.').slice(0, -1).join('.');

            console.log("Running:", fileName);
            
            // Clear previous outputs
            delete self.fsWrapperStorage[fileName + ".bst"];
            delete self.fsWrapperStorage[fileName + ".lst"];
            delete self.fsWrapperStorage[fileName + ".e"];
            
            self.fsWrapperStorage[filePath] = code;
            self.fsWrapperStorage["name.nnn"] = name || "noname";

            // Capture stdout, stderr, and stdin handling
            if (self.process && self.process.subscribers) {
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
                        console.log("stdin requested");
                        self.waitForInput();
                    }
                });
            }

            // Run LCC Compiler
            try {
                lcc.main([filePath]);
            } catch (e) {
                console.log(e);
                self.postMessage({ type: "stderr", data: e.toString() });
            }
        }
    } catch (e) {
        console.error("Error in worker message handler:", e);
        self.postMessage({ type: "stderr", data: "Worker error: " + e.toString() });
    }
};
