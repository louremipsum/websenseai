document.addEventListener("DOMContentLoaded", () => {
  const backButton = document.getElementById("back-button");
  const contextToggle = document.getElementById("context-toggle");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-button");
  const resetChatButton = document.getElementById("reset-chat");
  const closeButton = document.getElementById("close-button");

  let useContext = true;

  backButton.addEventListener("click", () => {
    chrome.browserAction.setPopup({ popup: "popup.html" });
    window.location.href = "popup.html";
  });

  contextToggle.addEventListener("click", () => {
    useContext = !useContext;
    contextToggle.classList.toggle("active");
    // You can add logic here to update the chat based on the context toggle
  });

  sendButton.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  resetChatButton.addEventListener("click", resetChat);
  closeButton.addEventListener("click", () => window.close());

  function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
      addMessageToChat("user", message);
      chatInput.value = "";
      // Simulate AI response (replace with actual AI integration later)
      setTimeout(() => {
        addMessageToChat("ai", `You said: ${message}`);
      }, 1000);
    }
  }

  function addMessageToChat(sender, content) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", `${sender}-message`);
    messageElement.innerHTML = `
        <div class="message-content">${content}</div>
      `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function resetChat() {
    chatMessages.innerHTML = "";
    // You can add additional logic here to reset the chat state
  }

  // Load chat history or initialize chat
  function initializeChat() {
    // You can add logic here to load previous chat messages or set up initial state
    chrome.storage.local.get(["selectedElement"], (result) => {
      if (result.selectedElement) {
        const contextPill = document.getElementById("context-pill");
        contextPill.textContent =
          result.selectedElement.substring(0, 30) + "...";
      }
    });
  }

  initializeChat();
});
