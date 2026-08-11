async function testProxy() {
  try {
    const url = 'https://www.youtube.com/watch?v=koZiIO7nyl0';
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    const html = await res.text();
    const match = html.match(/"captions":({.*?})/);
    if (match) {
      console.log("Success! Captions found.");
    } else {
      console.log("Failed to find captions. HTML length:", html.length);
    }
  } catch(e) {
    console.error(e);
  }
}
testProxy();
