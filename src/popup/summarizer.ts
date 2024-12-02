interface SummarizerOptions {
  sharedContext?: string;
  type: "key-points" | "tl;dr" | "teaser" | "headline";
  format: "markdown" | "plain-text";
  length: "short" | "medium" | "long";
}

interface ElementSelection {
  markdown: string;
  html: string;
}

const summarizerSharedContext: Record<string, string> = {
  default: "Write a clear and well-structured paragraph.",
  presentation: "This is for a presentation. Use bullet points.",
  social: "This is for a social media post. Keep it concise and engaging.",
};

let summarizer: any;

// Add this function near the top of the file, before initializeSummarizer
function setLoadingState(isLoading: boolean) {
  const generateButton = document.getElementById(
    "generate-button"
  ) as HTMLButtonElement;
  const outputTextArea = document.getElementById(
    "outputArea"
  ) as HTMLTextAreaElement;

  if (isLoading) {
    generateButton.disabled = true;
    generateButton.innerHTML = '<i class="lucide-loader"></i> Generating...';
    outputTextArea.value = "Generating summary...";
  } else {
    generateButton.disabled = false;
    generateButton.innerHTML = '<i class="lucide-zap"></i> Generate Summary';
  }
}

let activeControllerSummarizer: AbortController | null = null;

async function appendToOutputSummarizer(chunk: string) {
  const output = document.getElementById("output") as HTMLTextAreaElement;
  output.value += chunk;
  output.scrollTop = output.scrollHeight;
}

async function initializeSummarizer(options?: SummarizerOptions) {
  // @ts-ignore
  const { available } = await self.ai.summarizer.capabilities();
  console.log("Summarizer API availability:", available);
  if (available === "no") {
    console.error("The Summarizer API isn't usable.");
    return;
  }
  try {
    if (available === "readily") {
      // @ts-ignored
      summarizer = await self.ai.summarizer.create(options);
      console.log("Summarizer initialized successfully.");
    } else {
      console.log("Summarizer API is loading...");
      // @ts-ignored
      summarizer = await self.ai.summarizer.create(options);

      // Only add event listener if the summarizer supports it
      if (summarizer && typeof summarizer.addEventListener === "function") {
        summarizer.addEventListener("downloadprogress", (e: ProgressEvent) => {
          console.log(e.loaded, e.total);
        });
      }

      // Wait for ready state if available
      if (summarizer && typeof summarizer.ready !== "undefined") {
        console.log("Waiting for summarizer to be ready...");
        await summarizer.ready;
      }
    }
  } catch (error) {
    console.error("Error initializing summarizer:", error);
    throw error;
  }
}

async function processContent(text: string, options: SummarizerOptions) {
  setLoadingState(true);
  const outputTextArea = document.getElementById(
    "outputArea"
  ) as HTMLTextAreaElement;
  const additionalContext = document.getElementById(
    "additional-context-area"
  ) as HTMLTextAreaElement;
  outputTextArea.value = ""; // Clear previous output

  if (activeControllerSummarizer) {
    activeControllerSummarizer.abort();
  }

  activeControllerSummarizer = new AbortController();

  try {
    if (!summarizer) {
      await initializeSummarizer(options);
      console.log("Summarizer initialized during processing.");
    }

    if (!summarizer || typeof summarizer.summarizeStreaming !== "function") {
      throw new Error("Summarizer is not initialized properly.");
    }
    console.log("Processing content with summarizer:", options);

    // Generate summary using streaming
    const stream = await summarizer.summarizeStreaming(text, {
      context: additionalContext.value || "",
    });

    let previousLength = 0;
    for await (const segment of stream) {
      const newContent = segment.slice(previousLength);
      previousLength = segment.length;
      outputTextArea.value += newContent;
      outputTextArea.scrollTop = outputTextArea.scrollHeight;
    }
  } catch (error) {
    console.error("Error processing content:", error);
    outputTextArea.value =
      "An error occurred while processing the content. Please try again.";
  } finally {
    activeControllerSummarizer = null;
    setLoadingState(false);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const backButton = document.getElementById(
    "back-button"
  ) as HTMLButtonElement;
  const closeButton = document.getElementById(
    "close-button"
  ) as HTMLButtonElement;
  const selectButton = document.getElementById(
    "add-context"
  ) as HTMLButtonElement;
  const markdownOutput = document.getElementById(
    "markdown-output"
  ) as HTMLTextAreaElement;
  const summaryType = document.getElementById(
    "summary-type"
  ) as HTMLSelectElement;
  const summaryFormat = document.getElementById(
    "summary-format"
  ) as HTMLSelectElement;
  const summaryLength = document.getElementById(
    "summary-length"
  ) as HTMLSelectElement;
  const summaryStyle = document.getElementById(
    "summary-style"
  ) as HTMLSelectElement;
  const outputTextArea = document.getElementById(
    "outputArea"
  ) as HTMLTextAreaElement;
  const copyButton = document.getElementById(
    "copy-output"
  ) as HTMLButtonElement;
  const resetButton = document.getElementById(
    "reset-button"
  ) as HTMLButtonElement;
  const generateButton = document.getElementById(
    "generate-button"
  ) as HTMLButtonElement;

  backButton.addEventListener("click", () => {
    chrome.action.setPopup({ popup: "popup/popup.html" }, () => {
      window.location.href = "popup.html";
    });
  });

  closeButton.addEventListener("click", () => {
    if (activeControllerSummarizer) {
      activeControllerSummarizer.abort();
    }
    window.close();
  });

  selectButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "startDOMSelection" });
  });

  // Update storage retrieval to use 'elementSelection'
  chrome.storage.local.get(["elementSelection"], (result) => {
    if (
      result.elementSelection &&
      result.elementSelection.markdown &&
      markdownOutput
    ) {
      markdownOutput.value = result.elementSelection.markdown;
    }
  });

  generateButton.addEventListener("click", async () => {
    const selectedText = markdownOutput.value.trim();
    if (!selectedText) {
      outputTextArea.value =
        "Please select some content first using the Add Context button.";
      return;
    }

    const options: SummarizerOptions = {
      type: summaryType.value as SummarizerOptions["type"],
      format: summaryFormat.value as SummarizerOptions["format"],
      length: summaryLength.value as SummarizerOptions["length"],
    };

    options.sharedContext = summarizerSharedContext[summaryStyle.value];

    await processContent(selectedText, options);
  });

  // Update message listener to handle 'elementSelected' properly
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "error") {
      if (markdownOutput) {
        markdownOutput.value = message.error;
      }
      chrome.storage.local.set({ lastError: message.error });
    }
    if (message.type === "elementSelected") {
      if (message.markdown) {
        markdownOutput.value = message.markdown;
        chrome.storage.local.set({
          elementSelection: { markdown: message.markdown },
        });
      }
    }
  });

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(outputTextArea.value);
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 2000);
  });

  resetButton.addEventListener("click", () => {
    if (activeControllerSummarizer) {
      activeControllerSummarizer.abort();
    }
    outputTextArea.value = "";
    markdownOutput.value = "";
    chrome.storage.local.remove(["selectedElement", "processedContent"]);
  });

  // Update copy button handlers
  const copyMarkdownButton = document.getElementById(
    "copy-markdown"
  ) as HTMLButtonElement;
  const clearMarkdownButton = document.getElementById(
    "clear-markdown"
  ) as HTMLButtonElement;

  copyMarkdownButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(markdownOutput.value);
    copyMarkdownButton.innerHTML = '<i class="lucide-check"></i>';
    setTimeout(() => {
      copyMarkdownButton.innerHTML = '<i class="lucide-clipboard-copy"></i>';
    }, 2000);
  });

  clearMarkdownButton.addEventListener("click", () => {
    markdownOutput.value = "";
    chrome.storage.local.remove(["selectedElement"]);
  });

  // Update element selection handler
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "elementSelected") {
      const content = message.markdown || message.html;
      markdownOutput.value = message.markdown; // Ensure markdown is used
      chrome.storage.local.set({ selectedElement: message.markdown });
    }
  });

  // Check for stored content on load
  chrome.storage.local.get(["selectedElement"], (result) => {
    if (result.selectedElement) {
      markdownOutput.value = result.selectedElement;
    }
  });

  // Initialize summarizer
  await initializeSummarizer();
});
