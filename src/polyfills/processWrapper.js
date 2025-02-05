console.warn("Process Polyfill is being used in the browser.");

const inputBuffer = [];
let inputCallback = null;

// Create a hidden input element to simulate stdin
const stdinInput = document.createElement("input");
stdinInput.type = "text";
stdinInput.style.position = "absolute";
stdinInput.style.left = "-9999px"; // Hide it offscreen
document.body.appendChild(stdinInput);

// Capture user input into the buffer
stdinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        inputBuffer.push(stdinInput.value + "\n");
        stdinInput.value = "";
        if (inputCallback) {
            inputCallback();
        }
    }
});

const process = {
    cwd: () => "/",
    env: {},
    exit: (code) => {
        process.subscribers.forEach(callback => callback("exit", code));
        console.warn("Process exited with code:", code);
    },
    stdout: {
        write: (data) => {
            process.subscribers.forEach(callback => callback("stdout.write", data));
            console.log(data)
        }
    },
    platform: "browser",
    argv: ["browser", "polyfill"],
    stdin: {
        fd: 0, // Fake file descriptor
        read: (callback) => {
            process.subscribers.forEach(callback => callback("stdin"));
            inputCallback = callback;
            stdinInput.focus();
        },
        readSync: () => {
            process.subscribers.forEach(callback => callback("stdin"));
            return inputBuffer.length > 0 ? inputBuffer.shift() : null;
        }
    },

    // Subscribe to events
    subscribers: [],
    subscribe: (callback) => {
        process.subscribers.push(callback);
    }
};

window.process = process;

export default process;
