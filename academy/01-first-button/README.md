# Lesson 01 — Your first button

**Time:** 30–45 minutes  
**Goal:** one full-screen button that logs to the browser console.

## Why a button first?

Gaze and AI are **exciting** — but if HTML/CSS/React feel scary, the magic breaks. One giant button proves your toolchain works.

## Steps (copy-paste friendly)

1. Create `lesson-01/` **outside** this repo OR in a branch — keep `main` clean if you are nervous.  
2. Run `npm create vite@latest lesson-01 -- --template react-ts`.  
3. Replace `src/App.tsx` with:

```tsx
export default function App() {
  return (
    <button
      type="button"
      style={{ fontSize: "48px", padding: "48px" }}
      onClick={() => console.log("hello from ring academy")}
    >
      Tap me
    </button>
  );
}
```

4. `npm run dev` and click — open DevTools → Console.

## Reflection (write 3 sentences)

> If my grandmother saw this screen, would she know **what happens** when the button fires?

Save your answer in `reflection.txt` for your mentor.

## Next

[`checkpoint.md`](./checkpoint.md) then [`../02-gaze-magic/README.md`](../02-gaze-magic/README.md).
