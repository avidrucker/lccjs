console.warn("Process Polyfill is being used in the browser.");
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
};

export default process;