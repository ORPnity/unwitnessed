# UNWITNESSED

> Nothing witnessed. No identity. No history. Conversations without traces.

A privacy-focused, anonymous, encrypted chat platform. No accounts, no emails, no phone numbers. Just Room ID + Password.

---

## Project Structure

```
unwitnessed/
├── client/          ← Next.js frontend (deploy to Vercel)
│   ├── src/
│   │   ├── app/           UI pages & styles
│   │   ├── components/    CreateRoom, JoinRoom, ChatRoom
│   │   └── lib/           Encryption, types, WebSocket hook
│   ├── package.json
│   └── .env.example
│
├── server/          ← WebSocket server (deploy to Render/Railway)
│   ├── src/
│   │   └── index.ts       Zero-knowledge signal relay
│   ├── package.json
│   ├── Dockerfile
│   └── render.yaml
│
└── README.md
```

---

## Deployment Guide

### Step 1: Deploy Backend (Render)

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo (or upload the `server/` folder)
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free
4. Add environment variable:
   - `PORT` = `3001` (Render sets this automatically, but just in case)
5. Deploy — note your URL (e.g. `https://unwitnessed-server.onrender.com`)

### Step 2: Deploy Backend (Railway — Alternative)

1. Create a new project on [railway.app](https://railway.app)
2. Upload the `server/` folder
3. Railway auto-detects Node.js
4. It will run `npm install && npm run build` then `npm start`
5. Note your URL (e.g. `https://unwitnessed-server.up.railway.app`)

### Step 3: Deploy Frontend (Vercel)

1. Create a new project on [vercel.com](https://vercel.com)
2. Connect your GitHub repo (or upload the `client/` folder)
3. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (default)
4. Add environment variable:
   - `NEXT_PUBLIC_SOCKET_URL` = `wss://unwitnessed-server.onrender.com`
   
   ⚠️ Use `wss://` (not `ws://`) for production!
5. Deploy

### That's it! 🎉

---

## Local Development

```bash
# Terminal 1: Start the backend
cd server
npm install
npm run dev

# Terminal 2: Start the frontend
cd client
npm install
npm run dev
```

Frontend: http://localhost:3000
Backend: ws://localhost:3001

---

## Environment Variables

### Client (`client/.env.local`)
```
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3001        # local dev
NEXT_PUBLIC_SOCKET_URL=wss://your-server.onrender.com  # production
```

### Server (`server/.env`)
```
PORT=3001
ALLOWED_ORIGINS=*
```

---

## Security

- **E2E Encryption**: XSalsa20-Poly1305 via tweetnacl (libsodium-compatible)
- **Key Exchange**: X25519 ECDH
- **Zero-Knowledge Server**: Blind relay — never sees plaintext messages
- **Self-Destructing Rooms**: Destroyed when all users leave
- **No Tracking**: No typing indicators, read receipts, online status, analytics
- **No Storage**: No message database, no backups, no logs
