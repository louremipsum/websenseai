# WebSense AI

WebSense AI is a Chrome extension that leverages Chrome built-in AI APIs to analyze and understand the content on your screen. It provides various functionalities such as summarizing content, creating new content, and converting HTML to Markdown and chat regrading the content your the screen.

## Features

- **Element Selection**: Select any element on a webpage to analyze its content.
- **Markdown Conversion**: Convert selected HTML content to Markdown format.
- **Chat**: Select upto 3 elements as context to chat with.
- **Content Summarization**: Generate summaries of selected content with customizable options.
- **Content Creation**: Create new content based on templates and user-provided context.
- **Context Management**: Manage multiple contexts for better content generation and summarization.

## Installation

1. Clone the repository:

```sh
   git clone https://github.com/louremipsum/websenseai.git
```

2 Navigate to the project directory:

```sh
   cd websenseai
```

3 Install dependencies:

```sh
   npm install
```

4 Build the project:

```sh
   npm run build
```

5 Load the extension in Chrome:

- Open Chrome Dev and navigate to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select the `dist` directory

6 Experimental Flags

Turn on All experimental flag necessary for Prompt API, Write/Rewrite API, Summarization API and Translation API.

## Usage

1. Click on the WebSense AI extension icon in the Chrome toolbar.
2. Use the popup interface to select elements, generate summaries, or create new content.
3. Customize the options as needed and view the results directly in the popup.

## Project Structure

- `src/`: Source code for the extension
  - `background.ts`: Background script for handling extension events
  - `popup/`: Popup interface files
    - `chat.ts`: Chat functionality
    - `create.ts`: Content creation functionality
    - `summarizer.ts`: Content summarization functionality
  - `scripts/`: Content scripts
    - `content.ts`: Script injected into web pages for element selection
- `public/`: Public assets and manifest file
- `webpack/`: Webpack configuration files

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch:

   ```sh
   git checkout -b feature-branch
   ```

3. Make your changes and commit them:

   ```sh
   git commit -m "Add new feature"
   ```

4. Push to the branch:

   ```sh
   git push origin feature-branch
   ```

5. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Author

Vinayak Nigam
