document.addEventListener("DOMContentLoaded", async () => {
  const backButton = document.getElementById(
    "back-button"
  ) as HTMLButtonElement;
  const selectButton = document.getElementById(
    "select-element"
  ) as HTMLButtonElement;
  const targetLanguage = document.getElementById(
    "target-language"
  ) as HTMLSelectElement;
  const summaryType = document.getElementById(
    "summary-type"
  ) as HTMLSelectElement;
  const detectedLanguageSpan = document.getElementById(
    "detected-language"
  ) as HTMLSpanElement;
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

  let detector: any;
  try {
    // @ts-ignore
    detector = await self.translation.createDetector();
    await detector.ready;
  } catch (err) {
    console.error("Language detection not available:", err);
  }

  backButton.addEventListener("click", () => {
    chrome.action.setPopup({ popup: "popup/popup.html" }, () => {
      window.location.href = "popup.html";
    });
  });

  selectButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "startDOMSelection" });
  });

  generateButton.addEventListener("click", () => {
    const selectedText = output.value;
    if (selectedText) {
      processContent(selectedText, summaryType.value);
    }
  });

  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === "elementSelected") {
      const text = message.html.replace(/<[^>]*>/g, " ").trim();

      // Detect language
      const [detection] = await detector.detect(text);
      const sourceLanguage = detection.detectedLanguage;
      detectedLanguageSpan.textContent = sourceLanguage;

      // Create translator if needed
      if (sourceLanguage !== targetLanguage.value) {
        // @ts-ignore
        const translator = await self.translation.createTranslator({
          sourceLanguage,
          targetLanguage: targetLanguage.value,
        });
        const translatedText = await translator.translate(text);
        processContent(translatedText, summaryType.value);
      } else {
        processContent(text, summaryType.value);
      }
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
    detectedLanguageSpan.textContent = "None";
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

async function processContent(text: string, type: string) {
  setLoadingState(true);
  const output = document.getElementById("output") as HTMLTextAreaElement;
  const targetLanguage = (
    document.getElementById("target-language") as HTMLSelectElement
  ).value;

  try {
    // Check API availability
    // @ts-ignore
    if (!("translation" in self) || !("createDetector" in self.translation)) {
      throw new Error("Translation API not supported");
    }

    // Language detection
    // @ts-ignore
    const detector = await self.translation.createDetector();
    const [detection] = await detector.detect(text.trim());
    const { detectedLanguage, confidence } = detection;

    // Update detected language display
    const detectedSpan = document.getElementById(
      "detected-language"
    ) as HTMLSpanElement;
    detectedSpan.textContent = `${languageTagToHumanReadable(
      detectedLanguage,
      "en"
    )} (${(confidence * 100).toFixed(1)}%)`;

    // Initialize AI model
    const { available } =
      // @ts-ignore
      await chrome.aiOriginTrial.languageModel.capabilities();
    if (available !== "readily") {
      throw new Error("AI model not readily available");
    }

    // @ts-ignore
    const session = await chrome.aiOriginTrial.languageModel.create({
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

    // Translate if needed
    if (detectedLanguage !== targetLanguage) {
      if (!["en", "ja", "es", "hi"].includes(detectedLanguage)) {
        throw new Error("Source language not supported");
      }

      // @ts-ignore
      const translator = await self.translation.createTranslator({
        sourceLanguage: detectedLanguage,
        targetLanguage,
      });

      output.value = await translator.translate(processedText);
    } else {
      output.value = processedText;
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

function languageTagToHumanReadable(tag: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(tag) || tag;
  } catch (error) {
    console.error("Error converting language tag:", error);
    return tag;
  }
}
