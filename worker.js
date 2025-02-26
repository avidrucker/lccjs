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
let waitingForInput = false;
let inputCallback = null;
let inputBuffer = [];

// Output handling
let outputBuffer = '';

// Known prompts to detect
const KNOWN_PROMPTS = [
  "Name: ",
  "What's your first name? ",
  "What's your last name? "
];

// Handle messages from the main thread
self.onmessage = function(event) {
  try {
    const { type, payload } = event.data;
    
    if (type === "fallback") {
      console.log("Using fallback mechanism for input/output");
      // Initialize fallback mechanism
      self.inputBuffer = [];
    } else if (type === "stdin-fallback") {
      // Handle input from the main thread
      const input = payload.input;
      console.log("Received input via fallback:", input);
      waitingForInput = false;
      
      // Convert the input to a buffer
      const encoded = new TextEncoder().encode(input + '\n');
      
      // Process the input
      if (!self.inputBuffer) {
        self.inputBuffer = [];
      }
      
      for (let i = 0; i < encoded.length; i++) {
        self.inputBuffer.push(encoded[i]);
      }
      
      // Echo the input to the terminal
      if (self.process && self.process.stdout) {
        self.process.stdout.write(input + "\n");
      }
      
      // If there's a callback, call it
      if (inputCallback) {
        inputCallback();
        inputCallback = null;
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

      // Reset state
      outputBuffer = '';
      waitingForInput = false;
      
      // Override the waitForInput function
      self.waitForInput = function() {
        waitingForInput = true;
        
        // Signal to the main thread that we're waiting for input
        self.postMessage({ type: "stdin-request" });
        
        // Set up a callback to continue execution after input is received
        inputCallback = () => {
          console.log("Input callback executed");
        };
      };
      
      // Capture stdout and stderr output
      if (self.process && self.process.subscribers) {
        if (self.process.subscribers.length > 0) {
          self.process.subscribers = [];
        }
        
        self.process.subscribe((type, data) => {
          if (type === "stdout.write") {
            // Buffer the output
            outputBuffer += data;
            
            // Check if this is a prompt
            for (const prompt of KNOWN_PROMPTS) {
              if (outputBuffer.includes(prompt)) {
                // Send the complete prompt
                self.postMessage({ type: "stdout", data: outputBuffer });
                outputBuffer = '';
                
                // Wait for input
                self.waitForInput();
                return;
              }
            }
            
            // If we have a newline, send the line
            if (outputBuffer.includes('\n')) {
              self.postMessage({ type: "stdout", data: outputBuffer });
              outputBuffer = '';
            }
            
            // If we have more than 20 characters, send it
            if (outputBuffer.length > 20) {
              self.postMessage({ type: "stdout", data: outputBuffer });
              outputBuffer = '';
            }
          } else if (type === "stderr.write") {
            // Send stderr immediately
            self.postMessage({ type: "stderr", data: data });
          } else if (type === "exit") {
            // Flush any remaining output
            if (outputBuffer) {
              self.postMessage({ type: "stdout", data: outputBuffer });
              outputBuffer = '';
            }
            self.postMessage({ type: "exit", code: data });
          } else if (type === "stdin") {
            console.log("stdin requested");
            
            // Wait for input
            self.waitForInput();
          }
        });
      }

      // Run the LCC compiler
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
