document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements with type assertions
  const selectElementButton = document.getElementById(
    "select-element"
  ) as HTMLButtonElement;
  const markdownOutput = document.getElementById(
    "markdown-output"
  ) as HTMLTextAreaElement;
  const copyMarkdownButton = document.getElementById(
    "copy-markdown"
  ) as HTMLButtonElement;
  const clearMarkdownButton = document.getElementById(
    "clear-markdown"
  ) as HTMLButtonElement;
  const chatButton = document.getElementById(
    "chat-button"
  ) as HTMLButtonElement;
  const summarizeButton = document.getElementById(
    "summarize-button"
  ) as HTMLButtonElement;
  const createButton = document.getElementById(
    "create-button"
  ) as HTMLButtonElement;
  const closePopupButton = document.getElementById(
    "close-popup"
  ) as HTMLButtonElement;

  // Null checks for all DOM elements
  if (
    !selectElementButton ||
    !markdownOutput ||
    !copyMarkdownButton ||
    !clearMarkdownButton ||
    !chatButton ||
    !summarizeButton ||
    !createButton ||
    !closePopupButton
  ) {
    console.error("Required DOM elements not found");
    return;
  }

  // Check for stored selected element when popup opens
  chrome.storage.local.get(["selectedElement"], (result) => {
    if (result.selectedElement && markdownOutput) {
      markdownOutput.value = result.selectedElement;
    }
  });

  // Event Listeners
  selectElementButton.addEventListener("click", handleElementSelection);
  copyMarkdownButton.addEventListener("click", handleCopyMarkdown);
  clearMarkdownButton.addEventListener("click", handleClearMarkdown);
  chatButton.addEventListener("click", () => changePopup("chat.html"));
  summarizeButton.addEventListener("click", () =>
    changePopup("summarizer.html")
  );
  createButton.addEventListener("click", () => changePopup("create.html"));
  closePopupButton.addEventListener("click", () => window.close());

  // Functions with proper type definitions
  function handleElementSelection(): void {
    chrome.runtime.sendMessage({ type: "startDOMSelection" });
    window.close();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "error") {
      const markdownOutput = document.getElementById(
        "markdown-output"
      ) as HTMLTextAreaElement;
      if (markdownOutput) {
        markdownOutput.value = message.error;
      }
      // Prevent popup from closing on error
      chrome.storage.local.set({ lastError: message.error });
    }
  });

  async function handleCopyMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(markdownOutput.value);
      updateCopyButtonIcon(true);
      setTimeout(() => updateCopyButtonIcon(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  function handleClearMarkdown(): void {
    markdownOutput.value = "";
    chrome.storage.local.remove("selectedElement");
  }

  function updateCopyButtonIcon(success: boolean): void {
    copyMarkdownButton.innerHTML = success
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  }

  function changePopup(htmlFile: string): void {
    const popupPath = `popup/${htmlFile}`;
    chrome.action.setPopup({ popup: popupPath }, () => {
      window.location.href = htmlFile;
    });
  }

  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "elementSelected") {
      markdownOutput.value =
        request.markdown || convertHtmlToMarkdown(request.html);
      chrome.storage.local.set({
        selectedElement: markdownOutput.value,
        originalHtml: request.html,
      });
    }
  });

  // Add fade-in animation to main elements
  const mainElements = document.querySelectorAll("main > *");
  mainElements.forEach((element, index) => {
    (element as HTMLElement).style.animation = `fadeIn 0.3s ease-out ${
      index * 0.1
    }s both`;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const markdownOutput = document.getElementById(
    "markdown-output"
  ) as HTMLTextAreaElement;

  if (markdownOutput) {
    chrome.storage.local.get(["elementSelection"], (result) => {
      if (result.elementSelection?.markdown) {
        markdownOutput.value = result.elementSelection.markdown;
      }
    });
  }
});
