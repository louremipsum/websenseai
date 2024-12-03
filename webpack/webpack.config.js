const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    background: path.resolve(__dirname, "..", "src", "background.ts"),
    "scripts/content": path.resolve(
      __dirname,
      "..",
      "src",
      "scripts",
      "content.ts"
    ),
    "popup/popup": path.resolve(__dirname, "..", "src", "popup", "popup.ts"),
    "popup/chat": path.resolve(__dirname, "..", "src", "popup", "chat.ts"),
    "popup/create": path.resolve(__dirname, "..", "src", "popup", "create.ts"),
    "popup/summarizer": path.resolve(
      __dirname,
      "..",
      "src",
      "popup",
      "summarizer.ts"
    ),
  },
  output: {
    path: path.resolve(__dirname, "../dist"),
    filename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          transpileOnly: true,
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: "asset/resource",
        generator: {
          filename: "images/[name][ext]",
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "../public/manifest.json"),
          to: path.resolve(__dirname, "../dist/manifest.json"),
        },
        {
          from: path.resolve(__dirname, "../src/popup/popup.html"),
          to: path.resolve(__dirname, "../dist/popup/popup.html"),
        },
        {
          from: path.resolve(__dirname, "../src/popup/popup.css"),
          to: path.resolve(__dirname, "../dist/popup/styles/popup.css"),
        },
        {
          from: path.resolve(__dirname, "../src/popup/chat.html"),
          to: path.resolve(__dirname, "../dist/popup/chat.html"),
        },
        {
          from: path.resolve(__dirname, "../src/popup/chat.css"),
          to: path.resolve(__dirname, "../dist/popup/styles/chat.css"),
        },
        {
          from: path.resolve(__dirname, "../src/popup/summarizer.html"),
          to: path.resolve(__dirname, "../dist/popup/summarizer.html"),
        },
        {
          from: path.resolve(__dirname, "../src/popup/summarizer.css"),
          to: path.resolve(__dirname, "../dist/popup/styles/summarizer.css"),
        },

        {
          from: path.resolve(__dirname, "../src/popup/create.html"),
          to: path.resolve(__dirname, "../dist/popup/create.html"),
        },
        {
          from: path.resolve(__dirname, "../src/popup/create.css"),
          to: path.resolve(__dirname, "../dist/popup/styles/create.css"),
        },
        {
          from: path.resolve(__dirname, "../public"),
          to: path.resolve(__dirname, "../dist/images"),
          filter: (resourcePath) => {
            return resourcePath.match(/\.(png|jpe?g|gif|svg)$/i);
          },
        },
      ],
    }),
  ],
};
