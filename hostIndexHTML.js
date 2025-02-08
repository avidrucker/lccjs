import express from "express";

const app = express();

// Set security headers
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
})

app.use(express.static(".")); // Serve files from /public


app.listen(8080, () => console.log("Server running on http://localhost:8080"));
