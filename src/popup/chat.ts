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
        <span class="context-title">Context ${context.markdown.slice(-4)}</span>
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

      // @ts-ignore
      const session = await chrome.aiOriginTrial.languageModel.create({
        systemPrompt: "You are a helpful and friendly assistant.",
        topK: 6,
        temperature: 1,
      });

      // Add context overflow listener
      session.addEventListener("contextoverflow", () => {
        console.warn("Context overflow detected!");
      });

      // Build prompt with token checking
      const prompt = await buildPrompt(message, session);
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
  async function buildPrompt(message: string, session: any): Promise<string> {
    const activeContexts = contexts.filter((c) => c.isActive);
    if (activeContexts.length === 0) return message;

    // Build potential prompt
    const potentialPrompt = `Given these contexts:\n${activeContexts
      .map((c, index) => `#${index + 1}:\n${c.markdown}`)
      .join(
        "\n\n"
      )}\n\nPlease answer the following question:\n${message} using the context above.`;

    try {
      // Check token count
      const tokenCount = await session.countPromptTokens(potentialPrompt);

      if (tokenCount > session.tokensLeft) {
        console.warn(
          `Token limit exceeded: ${tokenCount}/${session.maxTokens}`
        );

        // Try removing contexts one by one until it fits
        for (let i = activeContexts.length - 1; i >= 0; i--) {
          const reducedContexts = activeContexts.slice(0, i);
          const reducedPrompt = `Given these contexts:\n${reducedContexts
            .map((c, index) => `#${index + 1}:\n${c.markdown}`)
            .join(
              "\n\n"
            )}\n\nPlease answer the following question:\n${message} using the context above.`;

          const reducedTokenCount = await session.countPromptTokens(
            reducedPrompt
          );

          if (reducedTokenCount <= session.tokensLeft) {
            console.warn(
              `Reduced contexts to fit token limit. Using ${i} contexts.`
            );
            return reducedPrompt;
          }
        }

        // If still too long, just use the message
        console.warn(
          "All contexts removed due to token limit. Using only message."
        );
        return message;
      }

      return potentialPrompt;
    } catch (error) {
      console.error("Error counting tokens:", error);
      return message; // Fallback to just the message
    }
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

  // Listen for new element selections
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "elementSelected" && message.markdown) {
      console.log("Received markdown:", message.markdown);
      const newContext: Context = {
        id: Date.now().toString(),
        markdown: message.markdown,
        isActive: true,
      };
      updateContextState([...contexts, newContext]);
    }
  });

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
