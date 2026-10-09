async function convertActiveTab(tab) {
  if (!tab || !tab.id) return;

  let payload;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const clone = document.documentElement.cloneNode(true);
        clone
          .querySelectorAll(
            'script, noscript, template, iframe, object, embed, link, meta'
          )
          .forEach((node) => node.remove());
        return {
          title: document.title || 'Untitled',
          url: location.href,
          html: clone.innerHTML,
          favicon:
            (document.querySelector('link[rel~="icon"]') || {}).href || '',
          capturedAt: Date.now()
        };
      }
    });
    payload = result;
  } catch (err) {
    payload = { error: String(err && err.message ? err.message : err) };
  }

  try {
    await chrome.storage.session.set({ capture: payload });
  } catch (err) {
    payload = {
      error:
        'This page is too large to convert (' +
        String(err && err.message ? err.message : err) +
        ').'
    };
    await chrome.storage.session.set({ capture: payload });
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
}

chrome.action.onClicked.addListener(convertActiveTab);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'convert-page') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await convertActiveTab(tab);
});
