# Setup — tools you need

## 1. Install Node.js 20+

Download the **LTS** installer from [https://nodejs.org](https://nodejs.org).

Check in a terminal:

```bash
node -v
```

You should see `v20` or newer.

## 2. Install Git

[https://git-scm.com](https://git-scm.com)

## 3. Install VS Code (recommended)

[https://code.visualstudio.com](https://code.visualstudio.com)

Extensions we like:

- ESLint  
- Prettier (optional)

## 4. Clone ring-core (reference app)

Ask your mentor for the repository URL (GitHub / ZIP).

```bash
git clone <YOUR-URL> ring-core
cd ring-core
npm install
npm run dev
```

Open `http://localhost:3000` — you should see the patient home.

## 5. Accounts (mentor only)

Firebase and Gemini keys live in `.env.local`. **Never** paste keys into Discord or school chat — use a **password manager** or mentor vault.

## Next lesson

[`../01-first-button/README.md`](../01-first-button/README.md)
