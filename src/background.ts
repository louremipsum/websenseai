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

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

async function injectContentScript(tabId: number): Promise<void> {
  try {
    // Check if content script is already injected
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
  } catch {
    // If not injected, inject content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["scripts/content.js"],
    });
  }
}

async function verifyContentScriptConnection(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return true;
  } catch {
    return false;
  }
}

function getHighlightCSS(): string {
  return `
    .element-highlight {
      outline: 2px solid #2196f3 !important;
      outline-offset: 2px !important;
      background-color: rgba(33, 150, 243, 0.1) !important;
    }
  `;
}

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
