type AIWriterTone = "formal" | "neutral" | "casual";
type AIWriterFormat = "plain-text" | "markdown";
type AIWriterLength = "short" | "medium" | "long";
type AIRewriterTone = "as-is" | "more-formal" | "more-casual";
type AIRewriterFormat = "as-is" | "plain-text" | "markdown";
type AIRewriterLength = "as-is" | "shorter" | "longer";

// Add new type definitions
type TemplateType =
  | "blog"
  | "social"
  | "review"
  | "bio"
  | "data-explain"
  | "pros-cons"
  | "technical"
  | "eli5"
  | "formal"
  | "casual"
  | "shorter"
  | "constructive";

type TemplateOptions = {
  dataType?: "time-series" | "comparison" | "statistics";
  bioType?: "professional" | "academic" | "creative";
  audience?: "child" | "teen" | "adult";
};

document.addEventListener("DOMContentLoaded", async () => {
  const backButton = document.getElementById(
    "back-button"
  ) as HTMLButtonElement;
  const selectButton = document.getElementById(
    "select-element"
  ) as HTMLButtonElement;
  const markdownOutput = document.getElementById(
    "markdown-output"
  ) as HTMLTextAreaElement;
  const output = document.getElementById("output") as HTMLTextAreaElement;
  const copyButton = document.getElementById(
    "copy-output"
  ) as HTMLButtonElement;
  const resetButton = document.getElementById("reset") as HTMLButtonElement;
  const closeButton = document.getElementById(
    "close-button"
  ) as HTMLButtonElement;
  const generateButton = document.getElementById(
    "generate-button"
  ) as HTMLButtonElement;

  backButton.addEventListener("click", () => {
    chrome.action.setPopup({ popup: "popup/popup.html" }, () => {
      window.location.href = "popup.html";
    });
  });
  if (markdownOutput) {
    chrome.storage.local.get(["elementSelection"], (result) => {
      if (result.elementSelection?.markdown) {
        markdownOutput.value = result.elementSelection.markdown;
      }
    });
  }

  selectButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "startDOMSelection" });
  });

  chrome.storage.local.get(["selectedElement"], (result) => {
    if (result.selectedElement && markdownOutput) {
      markdownOutput.value = result.selectedElement;
    }
  });

  generateButton.addEventListener("click", () => {
    const selectedText = markdownOutput.value;
    const context = (
      document.getElementById("context") as HTMLTextAreaElement
    ).value.trim();

    if (!context) {
      alert(
        "Please provide additional context - this is required for the AI to understand how to process your text."
      );
      return;
    }

    if (selectedText) {
      const mode = document
        .querySelector(".mode-btn.active")
        ?.getAttribute("data-mode");
      // Only get template for write mode
      const template =
        mode === "write"
          ? (document.getElementById("write-template") as HTMLSelectElement)
              .value
          : undefined;
      createContent(selectedText, template);
    }
  });

  chrome.runtime.onMessage.addListener(async (message) => {
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
    if (message.type === "elementSelected") {
      markdownOutput.value = message.markdown;
      chrome.storage.local.set({
        selectedElement: markdownOutput.value,
        originalHtml: message.html,
      });

      // Get the current mode and template for processing
      const mode = document
        .querySelector(".mode-btn.active")
        ?.getAttribute("data-mode");
      const template =
        mode === "write"
          ? (document.getElementById("write-template") as HTMLSelectElement)
              .value
          : (document.getElementById("rewrite-template") as HTMLSelectElement)
              .value;

      const text = message.html
        ? message.html.replace(/<[^>]*>/g, " ").trim()
        : "";
      createContent(text, template);
    }
  });

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(output.value);
    copyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    setTimeout(() => {
      copyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;
    }, 2000);
  });

  resetButton.addEventListener("click", () => {
    if (activeController) {
      activeController.abort();
    }
    output.value = "";
    chrome.storage.local.remove(["selectedElement", "processedContent"]);
  });

  closeButton.addEventListener("click", () => {
    if (activeController) {
      activeController.abort();
    }
    window.close();
  });

  // Remove duplicated mode switching logic and keep only one version
  const modeBtns = document.querySelectorAll(".mode-btn");
  const contextGroup = document.querySelector(".context-group");

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const writeOptions = document.getElementById("write-options");
      const rewriteOptions = document.getElementById("rewrite-options");

      if (btn.getAttribute("data-mode") === "rewrite") {
        writeOptions?.classList.add("hidden");
        rewriteOptions?.classList.remove("hidden");
        contextGroup?.classList.remove("hidden");
      } else {
        writeOptions?.classList.remove("hidden");
        rewriteOptions?.classList.add("hidden");
        contextGroup?.classList.add("hidden");
      }
    });
  });

  // Update template handling
  const writeTemplate = document.getElementById(
    "write-template"
  ) as HTMLSelectElement;
  const rewriteTemplate = document.getElementById(
    "rewrite-template"
  ) as HTMLSelectElement;

  if (writeTemplate) {
    writeTemplate.addEventListener("change", () => {
      const template = writeTemplate.value as TemplateType;
      const tone = document.getElementById("write-tone") as HTMLSelectElement;

      switch (template) {
        case "formal":
        case "technical":
          tone.value = "formal";
          break;
        case "casual":
        case "social":
          tone.value = "casual";
          break;
        case "bio":
        case "data-explain":
          tone.value = "neutral";
          break;
      }
    });
  }

  if (rewriteTemplate) {
    rewriteTemplate.addEventListener("change", () => {
      const template = rewriteTemplate.value as TemplateType;
      const tone = document.getElementById("rewrite-tone") as HTMLSelectElement;

      switch (template) {
        case "formal":
          tone.value = "more-formal";
          break;
        case "casual":
          tone.value = "more-casual";
          break;
        case "eli5":
          tone.value = "more-casual";
          break;
      }
    });
  }
});

function setLoadingStateCreate(isLoading: boolean) {
  const generateButton = document.getElementById(
    "generate-button"
  ) as HTMLButtonElement;
  const generateIcon = generateButton.querySelector(".generate-icon");
  const spinnerIcon = generateButton.querySelector(".spinner-icon");

  if (isLoading) {
    generateButton.disabled = true;
    generateIcon?.classList.add("hidden");
    spinnerIcon?.classList.remove("hidden");
  } else {
    generateButton.disabled = false;
    generateIcon?.classList.remove("hidden");
    spinnerIcon?.classList.add("hidden");
  }
}

let activeController: AbortController | null = null;

async function appendToOutput(chunk: string) {
  const output = document.getElementById("output") as HTMLTextAreaElement;
  output.value += chunk;
  output.scrollTop = output.scrollHeight;
}

// Add template prompts
const templatePrompts: Record<string, string> = {
  paragraph: "Write a clear and well-structured paragraph.",
  blog: "Write a blog post that is engaging and informative, with clear sections and a natural flow.",
  social:
    "Create a social media post that is concise, engaging, and optimized for social sharing.",
  review:
    "Write a balanced review that highlights both pros and cons, with specific details and reasoning.",
  bio: "Create a professional biography that effectively presents achievements and experience.",
  "data-explain":
    "Analyze and explain the data in a clear, structured way, highlighting key insights and trends.",
};

// Add new helper functions for translation
async function translateText(text: string, targetLang: string) {
  // @ts-ignore
  const translator = await self.translation.createTranslator({
    sourceLanguage: "en",
    targetLanguage: targetLang,
  });
  return await translator.translate(text);
}

async function processWithTranslation(text: string, template?: string) {
  const output = document.getElementById("output") as HTMLTextAreaElement;
  const mode = document
    .querySelector(".mode-btn.active")
    ?.getAttribute("data-mode");
  const format = (document.getElementById("format") as HTMLSelectElement)
    .value as AIWriterFormat;
  const context = (document.getElementById("context") as HTMLTextAreaElement)
    .value;
  const language = (document.getElementById("language") as HTMLSelectElement)
    .value;

  try {
    let result = "";

    if (mode === "write") {
      const tone = (document.getElementById("write-tone") as HTMLSelectElement)
        .value as AIWriterTone;
      const length = (
        document.getElementById("write-length") as HTMLSelectElement
      ).value as AIWriterLength;

      // @ts-ignore
      const writer = await ai.writer.create({
        tone,
        format,
        length,
        sharedContext: context,
      });

      const templatePrompt = templatePrompts[template || ""] || "";
      result = await writer.write(text, {
        context: templatePrompt,
      });
    } else {
      const tone = (
        document.getElementById("rewrite-tone") as HTMLSelectElement
      ).value as AIRewriterTone;
      const length = (
        document.getElementById("rewrite-length") as HTMLSelectElement
      ).value as AIRewriterLength;

      // @ts-ignore
      const rewriter = await ai.rewriter.create({
        sharedContext: context,
      });

      result = await rewriter.rewrite(text, {
        tone,
        format,
        length,
      });
    }

    // Translate the result if language is not English
    if (language !== "en") {
      result = await translateText(result, language);
    }

    output.value = result;
  } catch (err) {
    output.value = `Error: ${
      err instanceof Error ? err.message : "Unknown error occurred"
    }`;
  } finally {
    setLoadingStateCreate(false);
  }
}

// Modify createContent to handle streaming vs non-streaming
async function createContent(text: string, template?: string) {
  setLoadingStateCreate(true);
  const output = document.getElementById("output") as HTMLTextAreaElement;
  output.value = "";

  if (activeController) {
    activeController.abort();
  }

  const language = (document.getElementById("language") as HTMLSelectElement)
    .value;

  // Use non-streaming approach for non-English languages
  if (language !== "en") {
    await processWithTranslation(text, template);
    return;
  }

  // Original streaming logic for English
  activeController = new AbortController();
  const mode = document
    .querySelector(".mode-btn.active")
    ?.getAttribute("data-mode");
  const format = (document.getElementById("format") as HTMLSelectElement)
    .value as AIWriterFormat;
  const context = (document.getElementById("context") as HTMLTextAreaElement)
    .value;

  let accumulatedResponse = "";
  let previousChunk = "";

  try {
    if (mode === "write") {
      const tone = (document.getElementById("write-tone") as HTMLSelectElement)
        .value as AIWriterTone;
      const length = (
        document.getElementById("write-length") as HTMLSelectElement
      ).value as AIWriterLength;
      const template = (
        document.getElementById("write-template") as HTMLSelectElement
      ).value as TemplateType;

      // @ts-ignore
      const writer = await ai.writer.create({
        tone,
        format,
        length,
        signal: activeController.signal,
        sharedContext: context,
      });

      // Combine user context with template prompt
      const templatePrompt = templatePrompts[template] || "";

      const stream = writer.writeStreaming(text, {
        context: templatePrompt,
        signal: activeController.signal,
      });

      for await (const chunk of stream) {
        const newChunk = chunk.startsWith(previousChunk)
          ? chunk.slice(previousChunk.length)
          : chunk;

        accumulatedResponse += newChunk;
        await appendToOutput(newChunk);
        previousChunk = chunk;
      }
    } else {
      const tone = (
        document.getElementById("rewrite-tone") as HTMLSelectElement
      ).value as AIRewriterTone;
      const length = (
        document.getElementById("rewrite-length") as HTMLSelectElement
      ).value as AIRewriterLength;

      // @ts-ignore
      const rewriter = await ai.rewriter.create({
        signal: activeController.signal,
        sharedContext: context,
      });

      const stream = rewriter.rewriteStreaming(text, {
        tone,
        format,
        length,
        signal: activeController.signal,
      });

      for await (const chunk of stream) {
        const newChunk = chunk.startsWith(previousChunk)
          ? chunk.slice(previousChunk.length)
          : chunk;

        accumulatedResponse += newChunk;
        await appendToOutput(newChunk);
        previousChunk = chunk;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      output.value = "Generation cancelled";
    } else {
      output.value = `Error: ${
        err instanceof Error ? err.message : "Unknown error occurred"
      }`;
    }
  } finally {
    activeController = null;
    setLoadingStateCreate(false);
  }
}
