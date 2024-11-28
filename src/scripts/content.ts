document.addEventListener("contextmenu", (event) => {
  const selectedHtml = window.getSelection()?.toString();
  if (selectedHtml) {
    const markdown = convertHtmlToMarkdown(selectedHtml);
    chrome.runtime.sendMessage({
      type: "elementSelected",
      html: selectedHtml,
      markdown,
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "convertToMarkdown") {
    try {
      const markdown = convertHtmlToMarkdown(message.html);
      sendResponse({ success: true, markdown });
    } catch (error) {
      console.error("Error converting HTML to Markdown:", error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  }
  return true; // Keep message channel open for async response
});

function convertHtmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let markdown = "";

  // Helper function to get text content while preserving some structure
  function cleanText(text: string): string {
    return text.trim().replace(/\s+/g, " ");
  }

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return cleanText(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes)
      .map((child) => processNode(child))
      .join("");

    switch (tagName) {
      case "h1":
        return `# ${children}\n\n`;
      case "h2":
        return `## ${children}\n\n`;
      case "h3":
        return `### ${children}\n\n`;
      case "h4":
        return `#### ${children}\n\n`;
      case "h5":
        return `##### ${children}\n\n`;
      case "h6":
        return `###### ${children}\n\n`;
      case "p":
        return `${children}\n\n`;
      case "strong":
      case "b":
        return `**${children}**`;
      case "em":
      case "i":
        return `*${children}*`;
      case "a":
        return `[${children}](${element.getAttribute("href")})`;
      case "img":
        return `![${element.getAttribute("alt") || ""}](${element.getAttribute(
          "src"
        )})`;
      case "code":
        return `\`${children}\``;
      case "pre":
        return `\`\`\`\n${children}\n\`\`\`\n\n`;
      case "ul":
        return element.children.length
          ? Array.from(element.children)
              .map((li) => `* ${processNode(li)}`)
              .join("\n") + "\n\n"
          : "";
      case "ol":
        return element.children.length
          ? Array.from(element.children)
              .map((li, i) => `${i + 1}. ${processNode(li)}`)
              .join("\n") + "\n\n"
          : "";
      case "blockquote":
        return `> ${children}\n\n`;
      case "br":
        return "\n";
      case "div":
        return `${children}\n\n`;
      default:
        return children;
    }
  }

  markdown = processNode(doc.body);
  return markdown.trim().replace(/\n{3,}/g, "\n\n");
}
