# ChatSphere Fresh (Windows + Local MongoDB)

This is a fresh, beginner-friendly MERN chat app starter. It uses **local MongoDB**, not Atlas, so it avoids Atlas SRV/DNS connection issues.

## Requirements
- Node.js installed
- MongoDB Community Server installed and running
- VS Code

## 1. Check MongoDB
Open PowerShell and run:
```powershell
Get-Service MongoDB
```
If status is `Running`, continue. If it is stopped:
```powershell
Start-Service MongoDB
```
If the service name is not found, open Windows Services (`Win + R`, type `services.msc`) and look for a MongoDB service. Start it if present.

## 2. Start backend
In VS Code, open this extracted `ChatSphereFresh` folder.
Open Terminal > New Terminal and run:
```powershell
cd server
copy .env.example .env
npm install
npm run dev
```
Leave this terminal running. The backend uses local MongoDB at `mongodb://127.0.0.1:27017/chatsphere_fresh`.

## 3. Start frontend
Open a second terminal (Terminal > New Terminal) and run:
```powershell
cd client
npm install
npm run dev
```
Open the URL Vite prints, usually http://localhost:5173.

## 4. Test
Register two accounts in two browser windows (normal + incognito), search for the other username, open the conversation, and send messages.

## Troubleshooting
- `ECONNREFUSED 127.0.0.1:27017`: MongoDB service is not running. Start the MongoDB service.
- `npm` not recognized: close and reopen VS Code after installing Node.js.
- If a command says the folder doesn't exist, check your terminal prompt. If it ends in `\server>`, do not run `cd server` again.
- Never share `.env` or passwords publicly.
