interface MessageResponse {
  success: boolean;
  error?: string;
  markdown?: string;
}

interface ElementSelection {
  html: string;
  markdown: string;
  timestamp: number;
}

interface Tab {
  id?: number;
  url?: string;
}

// Add underscore prefix for unused parameters
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "startDOMSelection") {
    handleDOMSelection(sendResponse);
    return true; // Keep connection open for async response
  }

  if (message.type === "elementSelected") {
    console.log("trying elementSelected");
    handleElementSelected(message, sendResponse);
    return true; // Keep connection open for async response
  }

  // Default response for unknown message types
  sendResponse({ success: false, error: "Unknown message type" });
  return false;
});

async function handleDOMSelection(
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    console.log("activeTab in DOM selection", activeTab);
    if (!activeTab?.id) {
      throw new Error("No active tab found");
    }

    // Check if URL is restricted
    if (isRestrictedUrl(activeTab.url)) {
      throw new Error(
        "Cannot access this page. Try a regular webpage instead."
      );
    }

    // Ensure content script is injected
    await injectContentScript(activeTab.id);

    // Inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId: activeTab.id },
      css: getHighlightCSS(),
    });

    // Inject selection logic
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: enableElementSelection,
    });
    console.log("enableElementSelection in DOM selection");
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error in DOM selection:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

/**
 * Handles the selection of an HTML element, converts it to markdown, and stores the selection.
 *
 * @param message - The message containing the HTML to be converted.
 * @param sendResponse - A callback function to send the response back to the sender.
 *
 * @throws Will throw an error if no active tab is found, if the content script is not connected,
 *         or if the HTML to markdown conversion fails.
 *
 * @remarks
 * This function performs the following steps:
 * 1. Queries the active tab in the current window.
 * 2. Verifies the connection to the content script.
 * 3. Sends a message to the content script to convert the HTML to markdown.
 * 4. Stores the HTML and markdown in local storage with a timestamp.
 * 5. Optionally sends a message to the popup script with the markdown.
 * 6. Creates a notification to inform the user.
 *
 * @example
 * chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 *   if (message.type === "elementSelected") {
 *     handleElementSelected(message, sendResponse);
 *   }
 * });
 *
 * @param message.html - The HTML string to be converted to markdown.
 *
 * @param sendResponse.success - Indicates whether the operation was successful.
 * @param sendResponse.markdown - The converted markdown string if the operation was successful.
 * @param sendResponse.error - The error message if the operation failed.
 */
async function handleElementSelected(
  message: any,
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      throw new Error("No active tab found");
    }

    // Verify connection
    const isConnected = await verifyContentScriptConnection(activeTab.id);
    if (!isConnected) {
      throw new Error("Content script not connected");
    }

    // Convert HTML to markdown
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: "convertToMarkdown",
      html: message.html,
    });

    if (!response?.markdown) {
      throw new Error("Failed to convert HTML to markdown");
    }

    // Store the selection under 'elementSelection' key
    await chrome.storage.local.set({
      elementSelection: {
        html: message.html,
        markdown: response.markdown,
        timestamp: Date.now(),
      },
    });

    // Optionally, send a message to the popup script
    chrome.runtime.sendMessage({
      type: "elementSelected",
      markdown: response.markdown,
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl:
        "https://github.com/louremipsum/websenseai/blob/main/public/logo48.png?raw=true",
      title: "Websense AI",
      message:
        "Open the WebsenseAI extension to see the selected element's markdown.",
      priority: 0,
    });

    sendResponse({ success: true, markdown: response.markdown });
  } catch (error) {
    console.error("Error in element selection:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

/**
 * Checks if the given URL is restricted.
 *
 * A URL is considered restricted if it is either undefined or starts with
 * "chrome://", "edge://", or "about:".
 *
 * @param url - The URL to check. If not provided, the function will return true.
 * @returns `true` if the URL is restricted, `false` otherwise.
 */
function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

/**
 * Injects a content script into the specified tab if it is not already injected.
 *
 * This function first attempts to send a "ping" message to the content script
 * to check if it is already present. If the content script responds, it logs
 * that the content script is already injected. If the content script does not
 * respond, it injects the content script and waits for a "CONTENT_SCRIPT_READY"
 * message indicating that the content script is ready.
 *
 * @param {number} tabId - The ID of the tab where the content script should be injected.
 * @returns {Promise<void>} A promise that resolves when the content script is confirmed to be injected and ready.
 * @throws Will throw an error if the script injection fails.
 */
async function injectContentScript(tabId: number): Promise<void> {
  try {
    // First try to ping to check if content script is already there
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    console.log("Content script already injected");
  } catch (error) {
    console.log("Injecting content script");
    // Inject the script and wait for it to be ready
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["scripts/content.js"],
    });

    // Wait for content script to be ready
    await new Promise<void>((resolve) => {
      const listener = (message: any, sender: any) => {
        if (
          message.type === "CONTENT_SCRIPT_READY" &&
          sender.tab?.id === tabId
        ) {
          chrome.runtime.onMessage.removeListener(listener);
          resolve();
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      // Timeout after 5 seconds
      setTimeout(() => resolve(), 5000);
    });
  }
}

/**
 * Verifies the connection to a content script in the specified tab.
 *
 * This function sends a "ping" message to the content script running in the given tab.
 * If the message is successfully sent and a response is received, the function returns `true`.
 * If an error occurs (e.g., the content script is not present or the tab is invalid), the function returns `false`.
 *
 * @param {number} tabId - The ID of the tab to which the message should be sent.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the content script is connected, or `false` otherwise.
 */
async function verifyContentScriptConnection(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a CSS string for highlighting elements.
 *
 * @returns {string} A string containing CSS rules for highlighting elements with a blue outline and a light blue background.
 */
function getHighlightCSS(): string {
  return `
    .element-highlight {
      outline: 2px solid #2196f3 !important;
      outline-offset: 2px !important;
      background-color: rgba(33, 150, 243, 0.1) !important;
    }
  `;
}

/**
 * Enables the selection of elements on the webpage by adding event listeners for mouseover and click events.
 * When an element is hovered over, it gets highlighted with a specific CSS class.
 * When an element is clicked, its outer HTML is sent to the background script via a Chrome runtime message.
 *
 * The function also sets up a listener for "ping" messages from the background script to respond with a success message.
 *
 * @remarks
 * - The function adds event listeners to the document for mouseover and click events.
 * - The hovered element is highlighted with the "element-highlight" CSS class.
 * - On click, the outer HTML of the hovered element is sent to the background script.
 * - The function cleans up event listeners and removes the highlight class when an element is selected.
 *
 * @example
 * // To use this function, simply call it in your content script:
 * enableElementSelection();
 */
function enableElementSelection() {
  let hoveredElement: Element | null = null;

  function handleMouseOver(event: MouseEvent) {
    event.stopPropagation();
    if (hoveredElement) {
      hoveredElement.classList.remove("element-highlight");
    }
    hoveredElement = event.target as Element;
    hoveredElement.classList.add("element-highlight");
  }

  function handleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (hoveredElement) {
      const html = hoveredElement.outerHTML;
      chrome.runtime.sendMessage({
        type: "elementSelected",
        html: html,
      });
      cleanup();
    }
  }

  function cleanup() {
    document.removeEventListener("mouseover", handleMouseOver, true);
    document.removeEventListener("click", handleClick, true);
    if (hoveredElement) {
      hoveredElement.classList.remove("element-highlight");
    }
  }

  // Add ping response handler
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "ping") {
      sendResponse({ success: true });
      return true;
    }
    return false;
  });

  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("click", handleClick, true);
}
