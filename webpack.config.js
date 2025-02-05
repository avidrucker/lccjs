import path from "path";
import webpack from "webpack";

export default {
  mode: "development",
  entry: "./src/core/lcc.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(process.cwd(), "dist"),
    library: "LCC", // ✅ This exposes LCC globally for browser use
    //libraryTarget: "window", // ✅ Makes it available as `window.LCC`
  },
  resolve: {
    alias: {
      path: "path-browserify",
      //process: "process/browser.js", // Required for `fs` to work
      process: path.resolve(process.cwd(), "src/polyfills/processWrapper.js"), 
      fs: path.resolve(process.cwd(), "src/polyfills/fsWrapper.js"), 
    },
    fallback: {
      fs: false,
      stream: false,
      buffer: false,
      url: false,
      util: false,
    },
    extensions: [".js", ".json"], // Allow extension-less imports
    fullySpecified: false, // Prevents Webpack from enforcing full specifiers
  },
  plugins: [
    new webpack.ProvidePlugin({
      // process: "process/browser.js", // Ensure process is fully specified
      process: [path.resolve(process.cwd(), "src/polyfills/processWrapper.js"), "default"], 
      Buffer: ["buffer", "Buffer"], // Ensure Buffer is fully specified
    }),
    new webpack.DefinePlugin({
      global: "{}", // ✅ Define global as an empty object at build time
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
};
