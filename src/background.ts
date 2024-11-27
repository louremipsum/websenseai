chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "startDOMSelection") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (activeTab.id) {
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

        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: enableElementSelection,
        });
      }
    });
    return true;
  }
});

// This needs to be added to handle element selection messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "elementSelected") {
    // Store the selected HTML in extension's storage
    chrome.storage.local.set({ selectedElement: message.html });
    // Send a response back
    sendResponse({ success: true });
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

  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("click", handleClick, true);
}
