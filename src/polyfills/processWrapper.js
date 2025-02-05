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
        console.warn("Process exited with code:", code);
    },
    stdout: {
        write: (data) => console.log(data),
    },
    platform: "browser",
    argv: ["browser", "polyfill"],
    stdin: {
        fd: 0, // Fake file descriptor
        read: (callback) => {
            inputCallback = callback;
            stdinInput.focus();
        },
        readSync: () => {
            return inputBuffer.length > 0 ? inputBuffer.shift() : null;
        }
    }
};

export default process;
