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

let summarizer: any;

async function initializeSummarizer() {
  // @ts-ignore
  const available = (await self.ai.summarizer.capabilities()).available;
  if (available === "no") {
    console.error("The Summarizer API isn't usable.");
    return;
  }

  const options: SummarizerOptions = {
    type: "key-points",
    format: "markdown",
    length: "medium",
  };

  if (available === "readily") {
    // @ts-ignored
    summarizer = await self.ai.summarizer.create(options);
  } else {
    // @ts-ignored
    summarizer = await self.ai.summarizer.create(options);
    summarizer.addEventListener("downloadprogress", (e: ProgressEvent) => {
      console.log(e.loaded, e.total);
    });
    await summarizer.ready;
  }
}

// function setLoadingState(isLoading: boolean) {
//   const generateButton = document.getElementById(
//     "generate-button"
//   ) as HTMLButtonElement;
//   const spinnerIcon = generateButton.querySelector("svg");
//   if (isLoading) {
//     generateButton.disabled = true;
//     spinnerIcon?.classList.remove("hidden");
//   } else {
//     generateButton.disabled = false;
//     spinnerIcon?.classList.add("hidden");
//   }
// }

async function processContent(text: string, options: SummarizerOptions) {
  setLoadingState(true);
  const outputTextArea = document.getElementById(
    "output"
  ) as HTMLTextAreaElement;
  const targetLanguage = (
    document.getElementById("target-language") as HTMLSelectElement
  ).value;

  try {
    if (!summarizer) {
      await initializeSummarizer();
    }

    // Update summarizer options
    await summarizer.setOptions(options);

    // Generate summary
    const summary = await summarizer.summarize(text);

    // Translate summary if needed
    if (targetLanguage !== "en") {
      // @ts-ignore
      const translation = await self.ai.translation.translate(
        summary,
        targetLanguage
      );
      outputTextArea.value = translation;
    } else {
      outputTextArea.value = summary;
    }
  } catch (error) {
    console.error("Error processing content:", error);
    outputTextArea.value =
      "An error occurred while processing the content. Please try again.";
  } finally {
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
    "select-element"
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
    "output"
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
    window.close();
  });

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
      const options: SummarizerOptions = {
        type: summaryType.value as SummarizerOptions["type"],
        format: summaryFormat.value as SummarizerOptions["format"],
        length: summaryLength.value as SummarizerOptions["length"],
      };

      if (summaryStyle.value === "presentation") {
        options.sharedContext =
          "This is for a presentation. Use bullet points.";
      } else if (summaryStyle.value === "social") {
        options.sharedContext =
          "This is for a social media post. Keep it concise and engaging.";
      }

      processContent(selectedText, options);
    }
  });

  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === "error") {
      if (markdownOutput) {
        markdownOutput.value = message.error;
      }
      chrome.storage.local.set({ lastError: message.error });
    }
    if (message.type === "elementSelected") {
      markdownOutput.value =
        message.markdown || convertHtmlToMarkdown(message.html);
      chrome.storage.local.set({
        selectedElement: markdownOutput.value,
        originalHtml: message.html,
      });
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
    outputTextArea.value = "";
    markdownOutput.value = "";
    chrome.storage.local.remove(["selectedElement", "processedContent"]);
  });

  // Initialize summarizer
  await initializeSummarizer();
});
