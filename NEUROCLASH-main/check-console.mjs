import WebSocket from 'ws';

async function run() {
  const res = await fetch('http://localhost:9222/json');
  const targets = await res.json();
  console.log('Targets:', targets.map(t => ({ title: t.title, url: t.url })));
  const page = targets.find(t => t.type === 'page');
  if (!page) {
    console.log('No page target found');
    return;
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === msgId) {
          ws.off('message', handler);
          resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  ws.on('open', async () => {
    console.log('CDP Connected!');
    await send('Runtime.enable');
    await send('Log.enable');

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('EXCEPTION:', msg.params.exceptionDetails);
      }
    });

    // Evaluate clicking the initiate match / demo button
    console.log('Navigating to match...');
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        // Click the button that starts match or demo
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Initiate') || b.textContent.includes('Demo'));
        if (btn) {
          btn.click();
          'Clicked: ' + btn.textContent;
        } else {
          'No button found, document HTML: ' + document.body.innerHTML.substring(0, 200);
        }
      `
    });
    console.log('Eval result:', evalRes);

    setTimeout(async () => {
      // Check if there are buttons now (like in mode select, click Start)
      const evalRes2 = await send('Runtime.evaluate', {
        expression: `
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start') || b.textContent.includes('Demo'));
          if (btn) {
            btn.click();
            'Clicked 2: ' + btn.textContent;
          } else {
            'No second button, body: ' + document.body.innerHTML.substring(0, 300);
          }
        `
      });
      console.log('Eval result 2:', evalRes2);

      setTimeout(() => {
        process.exit(0);
      }, 2000);
    }, 1500);
  });
}

run().catch(console.error);
