document.addEventListener("contextmenu", (event) => {
  const selectedHtml = window.getSelection()?.toString();
  if (selectedHtml) {
    chrome.runtime.sendMessage(
      { type: "convertToMarkdown", html: selectedHtml },
      (response) => {
        if (response?.markdown) {
          console.log("Markdown:", response.markdown);
        }
      }
    );
  }
});

export function convertToMarkdown(html: string): string {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // This is a basic conversion. You can expand this function
  // to handle more HTML elements and attributes
  return tempDiv.innerText;
}
