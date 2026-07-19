# rc-robot

ESP8266 / NodeMCU RC car controller (Vite + React).

## Local (required for WebSocket)

```bash
npm install
npm run dev
```

Open on phone/PC (same Wi‑Fi as the NodeMCU):

```text
http://<YOUR_PC_LAN_IP>:3000
```

Enter the NodeMCU IP from Serial Monitor (e.g. `192.168.1.10`) and tap **Connect**.

Commands sent as plain text over `ws://IP:81`: `forward`, `backward`, `left`, `right`, `stop`.

> Vercel HTTPS cannot connect to a local `ws://` NodeMCU IP. Use the LAN `http://` link instead.
