// background.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "startDOMSelection") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab.id) return;

      // Check if URL is restricted
      if (
        activeTab.url?.startsWith("chrome://") ||
        activeTab.url?.startsWith("edge://") ||
        activeTab.url?.startsWith("about:")
      ) {
        chrome.runtime.sendMessage({
          type: "error",
          error: "Cannot access this page. Try a regular webpage instead.",
        });
        return;
      }

      try {
        // First inject content script if not already injected
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["scripts/content.js"],
        });

        // Then inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          css: `
         .element-highlight {
           outline: 2px solid #2196f3 !important;
           outline-offset: 2px !important;
           background-color: rgba(33, 150, 243, 0.1) !important;
         }
       `,
        });

        // Finally inject selection logic
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: enableElementSelection,
        });
      } catch (error) {
        console.error("Error injecting scripts:", error);
        // Send error back to popup
        chrome.runtime.sendMessage({
          type: "error",
          error: "Cannot access this page. Try a regular webpage instead.",
        });
      }
    });
    return true;
  }

  if (message.type === "elementSelected") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        console.error("No active tab found");
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(activeTab.id, {
          type: "convertToMarkdown",
          html: message.html,
        });

        // Send markdown back to chat.ts
        chrome.runtime.sendMessage({
          type: "elementSelected",
          markdown: response?.markdown,
        });
      } catch (error) {
        console.error("Error converting to markdown:", error);
      }
    });
    return true;
  }
});

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
      chrome.runtime
        .sendMessage({
          type: "elementSelected",
          html: html,
        })
        .catch((error) => {
          console.error("Error sending selected element:", error);
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

  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("click", handleClick, true);
}
