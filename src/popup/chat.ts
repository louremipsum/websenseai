interface ChatMessage {
  sender: "user" | "ai" | "system";
  content: string;
  role: "user" | "assistant" | "system"; // Add role property
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
  accordionHeader: HTMLButtonElement;
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
    accordionHeader: document.querySelector(
      ".accordion-header"
    ) as HTMLButtonElement,
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
  let messageHistory: ChatMessage[] = [
    {
      sender: "ai",
      role: "system",
      content: "You are a helpful and friendly assistant.",
    },
  ];

  // Add new function to save history
  async function saveHistory(history: ChatMessage[]): Promise<void> {
    await chrome.storage.local.set({ chatHistory: history });
  }

  // Add new function to load history
  async function loadHistory(): Promise<void> {
    const result = await chrome.storage.local.get("chatHistory");
    if (result.chatHistory) {
      messageHistory = result.chatHistory;
      // Replay messages in UI
      messageHistory.forEach((msg) => {
        if (msg.role !== "system") {
          addMessageToChat(msg.sender, msg.content);
        }
      });
    }
  }

  // Context management functions
  function updateContextState(newContexts: Context[]) {
    console.log("Updating contexts:", newContexts);
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
        <span class="context-title">${context.markdown.slice(0, 30)}</span>
        <div class="context-actions">
          <button class="toggle-context ${
            context.isActive ? "active" : ""
          }" data-id="${context.id}" aria-label="${
      context.isActive ? "Deactivate" : "Activate"
    } context">
            ${
              context.isActive
                ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`
            }
          </button>
          <button class="delete-context" data-id="${
            context.id
          }" aria-label="Delete context">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
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
    const contextCount = document.querySelector(".context-count");
    if (contextCount) {
      contextCount.textContent = contexts.length.toString();
    }
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
  elements.contextContainer.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;

    const contextId = button.dataset.id;
    if (!contextId) return;

    if (button.classList.contains("delete-context")) {
      console.log("Deleting context:", contextId);
      const newContexts = contexts.filter((c) => c.id !== contextId);
      console.log("New contexts after deletion:", newContexts);

      try {
        await chrome.storage.local.set({ contexts: newContexts });
        contexts = newContexts;
        updateContextPills();
      } catch (error) {
        console.error("Error deleting context:", error);
      }
    } else if (button.classList.contains("toggle-context")) {
      const updatedContexts = contexts.map((c) =>
        c.id === contextId ? { ...c, isActive: !c.isActive } : c
      );
      updateContextState(updatedContexts);
    }
  });

  elements.backButton.addEventListener("click", () => {
    chrome.action.setPopup({ popup: "popup/popup.html" });
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

  elements.accordionHeader.addEventListener("click", () => {
    const isExpanded =
      elements.accordionHeader.getAttribute("aria-expanded") === "true";
    elements.accordionHeader.setAttribute(
      "aria-expanded",
      (!isExpanded).toString()
    );
    elements.contextContainer.classList.toggle("collapsed");
  });

  // Initialize accordion state
  elements.accordionHeader.setAttribute("aria-expanded", "false");
  elements.contextContainer.classList.add("collapsed");

  async function sendMessage(): Promise<void> {
    const message = elements.chatInput.value.trim();
    if (!message) return;

    setLoadingState(true);
    addMessageToChat("user", message);
    elements.chatInput.value = "";

    // Add user message to history with proper typing
    messageHistory.push({
      sender: "user",
      role: "user",
      content: message,
    });
    await saveHistory(messageHistory);

    let accumulatedResponse = "";
    let previousChunk = "";

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

      // Create session with updated system prompt including context
      const systemPrompt = await buildSystemPrompt();
      const updatedHistory = [
        { sender: "system", role: "system", content: systemPrompt },
        ...messageHistory.slice(1), // Skip old system prompt
      ];

      // @ts-ignore
      const session = await chrome.aiOriginTrial.languageModel.create({
        initialPrompts: updatedHistory,
        topK: 6,
        temperature: 1,
      });

      // Remove old buildPrompt call since context is now in system prompt
      const stream = await session.promptStreaming(message);

      for await (const chunk of stream) {
        const newChunk = chunk.startsWith(previousChunk)
          ? chunk.slice(previousChunk.length)
          : chunk;

        accumulatedResponse += newChunk;
        contentElement.innerHTML = parseMarkdown(accumulatedResponse);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        previousChunk = chunk;
      }

      // After successful response, add AI message to history
      messageHistory.push({
        sender: "ai",
        role: "assistant",
        content: accumulatedResponse,
      });
      await saveHistory(messageHistory);

      // Trim history if it gets too long (keeping last N messages)
      const MAX_HISTORY = 10; // Adjust based on token limits
      if (messageHistory.length > MAX_HISTORY + 1) {
        // +1 for system prompt
        messageHistory = [
          messageHistory[0], // Keep system prompt
          ...messageHistory.slice(-MAX_HISTORY),
        ];
        await saveHistory(messageHistory);
      }

      session.destroy();
    } catch (error) {
      console.error("Error:", error);
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        contentElement.innerHTML = "Sorry, the message is too long to process.";
      } else {
        contentElement.innerHTML = "Sorry, I couldn't process your request.";
      }
    } finally {
      setLoadingState(false);
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .context-pill {
      display: flex;
      align-items: center;
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      border-radius: var(--radius);
      background: var(--secondary);
      transition: all 0.2s ease;
    }
  
    .context-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 0.5rem;
    }
  
    .context-title {
      font-size: 0.875rem;
      color: var(--foreground);
    }
  
    .context-actions {
      display: flex;
      gap: 0.25rem;
    }
  
    .toggle-context {
      padding: 0.25rem;
      border-radius: var(--radius);
      background: var(--muted);
      transition: all 0.2s ease;
    }
  
    .toggle-context.active {
      background: var(--primary);
      color: var(--primary-foreground);
    }
  
    .toggle-context:not(.active) {
      background: var(--muted);
      color: var(--muted-foreground);
    }
  
    .delete-context {
      padding: 0.25rem;
      border-radius: var(--radius);
      color: var(--destructive);
      transition: all 0.2s ease;
    }
  
    .delete-context:hover {
      background: var(--destructive);
      color: var(--destructive-foreground);
    }
  
    .icon-button svg {
      width: 1rem;
      height: 1rem;
    }
  `;
  document.head.appendChild(style);

  // Build prompt based on active contexts
  async function buildSystemPrompt(): Promise<string> {
    const activeContexts = contexts.filter((c) => c.isActive);
    if (activeContexts.length === 0) {
      return "You are a helpful and friendly assistant.";
    }

    return `You are a helpful and friendly assistant. Use the following contexts to inform your responses:
${activeContexts
  .map((c, index) => `#${index + 1}:\n${c.markdown}`)
  .join("\n\n")}`;
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

  chrome.storage.local.get(["elementSelection", "contexts"], (result) => {
    // Initialize existing contexts
    if (result.contexts) {
      contexts = result.contexts;
      updateContextPills();
    }

    // Handle new element selection if exists
    if (result.elementSelection?.markdown) {
      const newContext: Context = {
        id: Date.now().toString(),
        markdown: result.elementSelection.markdown,
        isActive: true,
      };
      updateContextState([...contexts, newContext]);

      // Clear the elementSelection after adding to context
      chrome.storage.local.remove("elementSelection");
    }
  });

  async function resetChat(): Promise<void> {
    elements.chatMessages.innerHTML = "";
    // Reset history with fresh system prompt
    messageHistory = [
      {
        sender: "ai",
        role: "system",
        content: "You are a helpful and friendly assistant.",
      },
    ];
    await saveHistory(messageHistory);
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

  // Load chat history after elements are validated
  loadHistory();
});
