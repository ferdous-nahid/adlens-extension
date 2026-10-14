chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: "toggle" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "download") return;
  chrome.downloads.download(
    { url: msg.url, filename: msg.filename, conflictAction: "uniquify", saveAs: false },
    () => void chrome.runtime.lastError
  );
});
