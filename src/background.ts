let active = false;

function makeOrange(color: string): void {
  document.body.style.backgroundColor = color;
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.url?.startsWith("chrome://")) return undefined;
  active = !active;
  const color = active ? "orange" : "white";
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id ? tab.id : -1 },
      func: makeOrange,
      args: [color],
    })
    .then();
});
