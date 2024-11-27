document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const selectElementButton = document.getElementById("select-element");
  const markdownOutput = document.getElementById("markdown-output");
  const copyMarkdownButton = document.getElementById("copy-markdown");
  const clearMarkdownButton = document.getElementById("clear-markdown");
  const chatButton = document.getElementById("chat-button");
  const summarizeButton = document.getElementById("summarize-button");
  const translateButton = document.getElementById("translate-button");
  const closePopupButton = document.getElementById("close-popup");

  // Check for stored selected element when popup opens
  chrome.storage.local.get(["selectedElement"], (result) => {
    if (result.selectedElement) {
      markdownOutput.value = result.selectedElement;
    }
  });

  // Event Listeners
  selectElementButton.addEventListener("click", handleElementSelection);
  copyMarkdownButton.addEventListener("click", handleCopyMarkdown);
  clearMarkdownButton.addEventListener("click", handleClearMarkdown);
  chatButton.addEventListener("click", () => changePopup("chat.html"));
  summarizeButton.addEventListener("click", () =>
    alert("Summarize functionality not implemented yet.")
  );
  translateButton.addEventListener("click", () =>
    alert("Translate functionality not implemented yet.")
  );
  closePopupButton.addEventListener("click", () => window.close());

  // Functions
  function handleElementSelection() {
    chrome.runtime.sendMessage({ type: "startDOMSelection" });
    window.close();
  }

  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdownOutput.value);
      updateCopyButtonIcon(true);
      setTimeout(() => updateCopyButtonIcon(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  function handleClearMarkdown() {
    markdownOutput.value = "";
    chrome.storage.local.remove("selectedElement");
  }

  function updateCopyButtonIcon(success) {
    copyMarkdownButton.innerHTML = success
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  }

  function changePopup(htmlFile) {
    chrome.storage.local.set({ currentPage: htmlFile });
    chrome.action.setPopup({ popup: htmlFile });
    window.location.href = htmlFile;
  }

  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "elementSelected") {
      markdownOutput.value = request.markdown;
      chrome.storage.local.set({ selectedElement: request.markdown });
    }
  });

  // Add fade-in animation to main elements
  const mainElements = document.querySelectorAll("main > *");
  mainElements.forEach((element, index) => {
    element.style.animation = `fadeIn 0.3s ease-out ${index * 0.1}s both`;
  });
});
