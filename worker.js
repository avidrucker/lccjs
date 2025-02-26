// worker.js
let randomnumber = Math.floor(Math.random() * 1000000);
self.importScripts("dist/bundle.js" + "?v=" + randomnumber); // Load the LCC compiler

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

// Input handling
let inputBuffer;
let inputView;
let inputIndex;
let indexView;
let inputBufferReady = false;

// Function to read input in a blocking manner
self.waitForInput = function waitForInput() {
  if (!inputBufferReady) {
    console.error("Input buffer not ready");
    return;
  }
  
  try {
    console.log("waitForInput", inputBuffer.byteLength);
    
    // Use a polling approach instead of Atomics.wait which requires SharedArrayBuffer
    // This is a fallback for browsers that don't support SharedArrayBuffer
    let length = 0;
    const checkInterval = setInterval(() => {
      length = Atomics.load(indexView, 0);
      if (length > 0) {
        clearInterval(checkInterval);
        
        let inputCopy = new Uint8Array(length);
        inputCopy.set(inputView.subarray(0, length));
        let inputStr = new TextDecoder().decode(inputCopy);
        
        for (let i = 0; i < inputCopy.length; i++) {
          if (!self.inputBuffer) {
            self.inputBuffer = [];
          }
          self.inputBuffer.push(inputCopy[i]);
        }
        
        console.log("Input:", inputStr);
        if (self.process && self.process.stdout) {
          self.process.stdout.write(inputStr + "\n");
        }
        
        // Reset index and allow new input
        Atomics.store(indexView, 0, 0);
      }
    }, 100);
    
    // Set a timeout to clear the interval after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 30000);
  } catch (e) {
    console.error("Error in waitForInput:", e);
  }
}

// Handle messages from the main thread
self.onmessage = function(event) {
  try {
    const { type, payload } = event.data;
    
    if (event.data.inputBuffer && event.data.inputIndex) {
      inputBuffer = event.data.inputBuffer;
      inputView = new Uint8Array(inputBuffer);
      inputIndex = event.data.inputIndex;
      indexView = new Int32Array(inputIndex);
      inputBufferReady = true;
      console.log("Worker received shared buffers.");
    } else if (type === "fallback") {
      console.log("Using fallback mechanism for input/output");
      // Initialize fallback mechanism
      self.inputBuffer = [];
      inputBufferReady = false;
      
      // Override waitForInput to use message passing instead of SharedArrayBuffer
      self.waitForInput = function() {
        // Send a message to the main thread requesting input
        self.postMessage({ type: "stdin-request" });
        
        // The main thread will respond with a message containing the input
        // This will be handled in the onmessage function
      };
    } else if (type === "stdin-fallback") {
      // Handle input from the main thread
      const input = payload.input;
      console.log("Received input via fallback:", input);
      
      // Convert the input to a buffer
      const encoded = new TextEncoder().encode(input + '\n');
      
      // Process the input
      for (let i = 0; i < encoded.length; i++) {
        if (!self.inputBuffer) {
          self.inputBuffer = [];
        }
        self.inputBuffer.push(encoded[i]);
      }
      
      // Write to stdout
      if (self.process && self.process.stdout) {
        self.process.stdout.write(input + "\n");
      }
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
            self.inputBuffer.push(bytesRead);
          } else {
            // Wait for more input
            waitForInput();
          }
        }
      });

      // Run the LCC compiler
      try {
        lcc.main([filePath]);
      } catch (e) {
        console.log(e);
        self.postMessage({ type: "stderr", data: e.toString() });
      }
    } else if (type === "stdin") {
      console.log("stdin generic", payload);
    }
  } catch (e) {
    console.error("Error in worker message handler:", e);
    self.postMessage({ type: "stderr", data: "Worker error: " + e.toString() });
  }
};
