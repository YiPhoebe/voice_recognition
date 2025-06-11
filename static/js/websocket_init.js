const serverIPs = ['localhost:11181', '192.168.3.19:11181'];
const statusEleml = [document.getElementById('status1'), document.getElementById('status2')];
let server1WS = null;
let server2WS = null;
let resolvedl = [false, false];
const sockets = [[],[]];
const TIMEOUT_MS = 5000;

const timeout = setTimeout(() => {
    statusEleml.forEach((statusElem,idx) => {
        if (!resolvedl[idx]) {
            // resolved = true;
            // Close all sockets still trying
            sockets.forEach(ws => {
                if (ws.readyState === WebSocket.CONNECTING) ws.close();
            });
            statusElem.textContent = 'Failed to connect wss server ' + (idx+1);
            console.warn(`❌ Failed to connect to WebSocket server ${idx + 1}`);
        }
    });
}, TIMEOUT_MS);

serverIPs.forEach((url, idx) => {
    const ws1 = new WebSocket('wss://' + url + '/ws/adhd');
    const ws2 = new WebSocket('wss://' + url + '/ws/general');
    sockets[0].push(ws1);
    sockets[1].push(ws2);

    [ws1,ws2].forEach((ws,idx) => {
        ws.onopen = () => {
            if (!resolvedl[idx]) {
                resolvedl[idx] = true;
                if (idx==0) { server1WS = ws;}
                else if (idx==1) { server2WS = ws;}
                // Close the other socket if it's still connecting
                sockets[idx].forEach((otherWs, otherIdx) => {
                    if (otherIdx !== idx && otherWs.readyState === WebSocket.CONNECTING) {
                        otherWs.close();
                    }
                });
                // console.log(`Connected to ${url}`);
                statusEleml[idx].textContent = `Server ${idx+1} Connected: ${ws.url}`;
                console.log(`✅ Connected to WebSocket Server ${idx + 1}: ${ws.url}`);
                // Proceed using chosenSocket
            }
        }
    
        ws.onerror = (err) => {
        };

        ws.onclose = () => {
            // Optionally handle close
        };
    });
});
