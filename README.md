# WebSense AI

![Know](https://github.com/user-attachments/assets/31fb975a-0319-45ce-aa8b-4d9ff002894e)
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

Open "chrome://on-device-translation-internals/" and then enable "en - es", "en - hi", "en - fr" language packs

## Usage

1. Click on the WebSense AI extension icon in the Chrome toolbar.
2. Use the popup interface to select elements, generate summaries, or create new content.
3. Customize the options as needed and view the results directly in the popup.

![1](https://github.com/user-attachments/assets/9ef74670-726e-426f-96c7-065ec578b237)
![2](https://github.com/user-attachments/assets/a345e503-c350-48ee-8759-2fd4f4e6af24)
![3](https://github.com/user-attachments/assets/aa6ac4aa-5469-4cd0-9943-ab2913ac6310)
![4](https://github.com/user-attachments/assets/67798d80-47ce-4970-9482-53fe5da813bc)

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
