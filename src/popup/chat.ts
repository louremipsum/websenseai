interface ChatMessage {
  sender: "user" | "ai";
  content: string;
}

interface Context {
  id: string;
  markdown: string;
  isActive: boolean;
}

interface RequiredElements {
  backButton: HTMLButtonElement;
  chatMessages: HTMLDivElement;
  chatInput: HTMLInputElement;
  sendButton: HTMLButtonElement;
  resetChatButton: HTMLButtonElement;
  exportChatButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  addContextButton: HTMLButtonElement;
  contextContainer: HTMLDivElement;
}

document.addEventListener("DOMContentLoaded", () => {
  // Updated DOM Elements with only existing elements
  const requiredElements = {
    backButton: document.getElementById("back-button") as HTMLButtonElement,
    chatMessages: document.getElementById("chat-messages") as HTMLDivElement,
    chatInput: document.getElementById("chat-input") as HTMLInputElement,
    sendButton: document.getElementById("send-button") as HTMLButtonElement,
    resetChatButton: document.getElementById("reset-chat") as HTMLButtonElement,
    exportChatButton: document.getElementById(
      "export-chat"
    ) as HTMLButtonElement,
    closeButton: document.getElementById("close-button") as HTMLButtonElement,
    addContextButton: document.getElementById(
      "add-context"
    ) as HTMLButtonElement,
    contextContainer: document.getElementById(
      "context-pills"
    ) as HTMLDivElement,
  };

  // Early validation of required elements
  const missingElements = Object.entries(requiredElements)
    .filter(([_, element]) => !element)
    .map(([key]) => key);

  if (missingElements.length > 0) {
    console.error("Missing required elements:", missingElements.join(", "));
    return;
  }

  const elements = requiredElements as RequiredElements;
  let contexts: Context[] = [];

  // Context management functions
  function updateContextState(newContexts: Context[]) {
    console.log("Updating contexts:", newContexts); // Debug log
    contexts = newContexts;
    chrome.storage.local.set({ contexts: newContexts }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving contexts:", chrome.runtime.lastError);
        return;
      }
      updateContextPills();
    });
  }

  function createContextPill(context: Context): HTMLElement {
    const pill = document.createElement("div");
    pill.className = `context-pill ${context.isActive ? "active" : ""}`;
    pill.innerHTML = `
       <div class="context-info">
      <svg class="clip-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
      </svg>
      <span class="context-title">Context #${context.markdown.slice(-4)}</span>
    </div>
      <div class="context-actions">
        <button class="icon-button toggle-context ${
          context.isActive ? "active" : ""
        }" data-id="${context.id}">
          ${
            context.isActive
              ? `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          `
              : `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          `
          }
        </button>
        <button class="icon-button delete-context" data-id="${context.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    return pill;
  }

  function setLoadingState(loading: boolean) {
    const sendButton = elements.sendButton;
    sendButton.disabled = loading;
    sendButton.classList.toggle("loading", loading);
    sendButton.innerHTML = loading
      ? `
      <svg class="loading-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle class="spinner" cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3"/>
      </svg>
      `
      : `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
      </svg>
      `;
  }

  function parseMarkdown(text: string): string {
    // Basic markdown parser
    return (
      text
        // Headers
        .replace(/^### (.*$)/gm, "<h3>$1</h3>")
        .replace(/^## (.*$)/gm, "<h2>$1</h2>")
        .replace(/^# (.*$)/gm, "<h1>$1</h1>")
        // Bold
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        // Italic
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        // Code blocks
        .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        // Lists
        .replace(/^\s*\n\*/gm, "<ul>\n*")
        .replace(/^(\*.+)\s*\n([^\*])/gm, "$1\n</ul>\n$2")
        .replace(/^\*(.+)/gm, "<li>$1</li>")
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Paragraphs
        .replace(/\n\s*\n/g, "\n<p>\n")
    );
  }

  // Update context display
  function updateContextPills() {
    elements.contextContainer.innerHTML = "";
    if (contexts.length === 0) {
      elements.contextContainer.innerHTML =
        '<div class="no-context">No contexts attached</div>';
      return;
    }
    contexts.forEach((context) => {
      elements.contextContainer.appendChild(createContextPill(context));
    });
  }

  elements.addContextButton.addEventListener("click", () => {
    if (contexts.length >= 3) {
      alert("Maximum 3 contexts allowed. Remove one to add new.");
      return;
    }
    chrome.runtime.sendMessage({ type: "startDOMSelection" });
  });

  // Handle context actions (toggle/delete)
  elements.contextContainer.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;

    const contextId = button.dataset.id;
    if (!contextId) return;

    if (button.classList.contains("delete-context")) {
      updateContextState(contexts.filter((c) => c.id !== contextId));
    } else if (button.classList.contains("toggle-context")) {
      updateContextState(
        contexts.map((c) =>
          c.id === contextId ? { ...c, isActive: !c.isActive } : c
        )
      );
    }
  });

  elements.backButton.addEventListener("click", () => {
    chrome.action.setPopup({ popup: "popup.html" });
    window.location.href = "popup.html";
  });

  elements.sendButton.addEventListener("click", () => sendMessage());
  elements.chatInput.addEventListener("keypress", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  elements.resetChatButton.addEventListener("click", resetChat);
  elements.exportChatButton.addEventListener("click", exportChat);
  elements.closeButton.addEventListener("click", () => window.close());

  async function sendMessage(): Promise<void> {
    const message = elements.chatInput.value.trim();
    if (!message) return;

    setLoadingState(true);
    addMessageToChat("user", message);
    elements.chatInput.value = "";

    const prompt = buildPrompt(message);
    let accumulatedResponse = "";
    let previousChunk = "";

    // Create message container for streaming
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", "ai-message");
    messageElement.innerHTML = '<div class="message-content"></div>';
    elements.chatMessages.appendChild(messageElement);
    const contentElement = messageElement.querySelector(
      ".message-content"
    ) as HTMLElement;

    try {
      const { available } =
        // @ts-ignore
        await chrome.aiOriginTrial.languageModel.capabilities();
      if (available !== "readily") {
        throw new Error("Gemini Nano model is not readily available");
      }

      // @ts-ignore
      const session = await chrome.aiOriginTrial.languageModel.create({
        systemPrompt: "You are a helpful and friendly assistant.",
        topK: 6,
        temperature: 1,
      });

      const stream = await session.promptStreaming(prompt);

      for await (const chunk of stream) {
        const newChunk = chunk.startsWith(previousChunk)
          ? chunk.slice(previousChunk.length)
          : chunk;

        accumulatedResponse += newChunk;
        contentElement.innerHTML = parseMarkdown(accumulatedResponse);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        previousChunk = chunk;
      }

      session.destroy();
    } catch (error) {
      console.error("Error:", error);
      contentElement.innerHTML = "Sorry, I couldn't process your request.";
    } finally {
      setLoadingState(false);
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .context-pill.active {
      background: var(--primary);
      color: var(--primary-foreground);
    }
    
    .loading-icon {
      animation: spin 1s linear infinite;
      width: 1.25rem;
      height: 1.25rem;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .toggle-context.active {
      background: var(--primary);
      color: var(--primary-foreground);
    }

    /* Markdown Styles */
    .message-content h1,h2,h3 { margin: 0.5em 0; font-weight: bold; }
    .message-content h1 { font-size: 1.4em; }
    .message-content h2 { font-size: 1.2em; }
    .message-content h3 { font-size: 1.1em; }
    .message-content code { 
      background: var(--secondary);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
    }
    .message-content pre code {
      display: block;
      padding: 1em;
      overflow-x: auto;
    }
  `;
  document.head.appendChild(style);

  // Handle context deletion
  elements.contextContainer.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;

    const contextId = button.dataset.id;
    if (!contextId) return;

    if (button.classList.contains("delete-context")) {
      console.log("Deleting context:", contextId); // Debug log
      const newContexts = contexts.filter((c) => c.id !== contextId);
      console.log("New contexts:", newContexts); // Debug log
      updateContextState(newContexts);
    } else if (button.classList.contains("toggle-context")) {
      updateContextState(
        contexts.map((c) =>
          c.id === contextId ? { ...c, isActive: !c.isActive } : c
        )
      );
    }
  });

  // Build prompt based on active contexts
  function buildPrompt(message: string): string {
    const activeContexts = contexts.filter((c) => c.isActive);
    if (activeContexts.length === 0) return message;

    return `Given these contexts:\n${activeContexts
      .map((c, index) => `#${index + 1}:\n${c.markdown}`)
      .join(
        "\n\n"
      )}\n\nPlease answer the following question:\n${message} using the context above.`;
  }

  // Initialize contexts from storage
  chrome.storage.local.get("contexts", (result) => {
    contexts = result.contexts || [];
    updateContextPills();
  });

  function addMessageToChat(
    sender: ChatMessage["sender"],
    content: string
  ): void {
    if (sender === "ai") return; // AI messages handled by streaming

    const messageElement = document.createElement("div");
    messageElement.classList.add("message", `${sender}-message`);
    messageElement.innerHTML = `
      <div class="message-content">${content}</div>
    `;
    elements.chatMessages.appendChild(messageElement);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  function updateContexts(newContexts: Context[]): void {
    chrome.storage.local.set({ contexts: newContexts }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving contexts:", chrome.runtime.lastError);
        return;
      }
      contexts = newContexts;
      updateContextPills();
    });
  }

  // Listen for new element selections
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "elementSelected" && message.markdown) {
      console.log("Received markdown:", message.markdown); // Debug log
      const newContext: Context = {
        id: Date.now().toString(),
        markdown: message.markdown,
        isActive: true,
      };
      updateContextState([...contexts, newContext]);
    }
  });

  function resetChat(): void {
    elements.chatMessages.innerHTML = "";
  }

  function exportChat(): void {
    const messages = Array.from(elements.chatMessages.children)
      .map((msg) => {
        const sender = msg.classList.contains("user-message") ? "User" : "AI";
        const content =
          msg.querySelector(".message-content")?.textContent || "";
        return `${sender}: ${content}`;
      })
      .join("\n");

    const blob = new Blob([messages], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_export.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
});
