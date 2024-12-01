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
  const summaryType = document.getElementById(
    "summary-type"
  ) as HTMLSelectElement;
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
    if (selectedText) {
      createContent(selectedText, summaryType.value);
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
      markdownOutput.value =
        message.markdown || convertHtmlToMarkdown(message.html);
      chrome.storage.local.set({
        selectedElement: markdownOutput.value,
        originalHtml: message.html,
      });
      const text = message.html.replace(/<[^>]*>/g, " ").trim();

      createContent(text, summaryType.value);
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
    output.value = "";
    chrome.storage.local.remove(["selectedElement", "processedContent"]);
  });

  closeButton.addEventListener("click", () => {
    window.close();
  });
});

function setLoadingState(isLoading: boolean) {
  const generateButton = document.getElementById(
    "generate-button"
  ) as HTMLButtonElement;
  const spinnerIcon = generateButton.querySelector("svg");
  if (isLoading) {
    generateButton.disabled = true;
    spinnerIcon?.classList.remove("hidden");
  } else {
    generateButton.disabled = false;
    spinnerIcon?.classList.add("hidden");
  }
}

async function createContent(text: string, type: string) {
  setLoadingState(true);
  const output = document.getElementById("output") as HTMLTextAreaElement;
  const targetLanguage = (
    document.getElementById("target-language") as HTMLSelectElement
  ).value;

  try {
    // Check API availability
    // @ts-ignore
    if (!("translation" in self)) {
      throw new Error("Translation API not supported");
    }

    // Initialize AI model
    const { available } =
      // @ts-ignore
      await self.ai.languageModel.capabilities();
    if (available !== "readily") {
      throw new Error("Gemini Nano model is not readily available");
    }

    // @ts-ignore
    const session = await self.ai.languageModel.create({
      systemPrompt:
        type === "social"
          ? "You are a social media content creator. Create engaging, concise posts."
          : "You are a presentation creator. Create clear, structured bullet points.",
      topK: 6,
      temperature: type === "social" ? 0.8 : 0.4,
    });

    // Process based on type
    const promptText =
      type === "social"
        ? `Create a social media post (max 240 chars) with hashtags from this text:\n${text}`
        : type === "presentation"
        ? `Create presentation bullet points from this text:\n${text}`
        : `Summarize this text in a concise manner:\n${text}`;

    // Get AI response
    const stream = await session.promptStreaming(promptText);
    let processedText = "";
    let previousChunk = "";

    for await (const chunk of stream) {
      const newChunk = chunk.startsWith(previousChunk)
        ? chunk.slice(previousChunk.length)
        : chunk;
      processedText += newChunk;
      previousChunk = chunk;
    }

    // Skip translation for English
    if (targetLanguage === "en") {
      output.value = processedText;
    } else {
      // @ts-ignore
      const translator = await self.translation.createTranslator({
        sourceLanguage: "en",
        targetLanguage,
      });
      output.value = await translator.translate(processedText);
    }

    session.destroy();
  } catch (err) {
    output.value = `Error: ${
      err instanceof Error ? err.message : "Unknown error occurred"
    }`;
  } finally {
    setLoadingState(false);
  }
}
