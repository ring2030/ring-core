/**
 * User-facing messages for seeso InitializationErrorType (SDK internal codes are fixed).
 * @see node_modules/seeso/dist/seeso.js → error-type.js
 */
export function describeEyedidInitError(code: number): string {
  switch (code) {
    case 0:
      return "";
    case 1:
      return [
        "Eyedid WASM failed to initialize (the dev license itself is often fine).",
        "Try: ① stop the dev server and run `npm run dev`, then hard-reload (Ctrl+Shift+R).",
        "② disable ad blockers / tracking protection. ③ try another browser (latest Chrome).",
        "④ in DevTools → Network, check that `cdn.seeso.io` is not blocked.",
      ].join(" ");
    case 2:
      return "Camera permission was denied by the Eyedid SDK. Allow the camera in the browser, then try again.";
    case 3:
      return "Invalid license key. Copy the key from the Eyedid console and check NEXT_PUBLIC_EYEDID_LICENSE_KEY in .env.local.";
    case 4:
      return "You are using a development license in production. Use a dev key on localhost and a production key on your live URL.";
    case 5:
      return "You are using a production license on localhost. Issue a development key in the Eyedid console and set it in .env.local.";
    case 6:
      return "Package name does not match the license (common for mobile apps). On the web, key type mismatch is a frequent cause.";
    case 7:
      return "App signature does not match the license (mobile).";
    case 8:
      return "Free tier limit reached. Check your plan in the Eyedid console.";
    case 9:
      return "License has been disabled. Check key status in the console.";
    case 10:
      return "Authentication failed (IP restrictions, encryption, etc.). Check network, VPN, and system time.";
    case 11:
      return "Unknown authentication error. Wait a moment and try again.";
    case 12:
      return "Eyedid server error (timeout, etc.). Try again shortly.";
    case 13:
      return "Cannot reach Eyedid servers. Check internet and firewall settings.";
    case 14:
      return "System clock is far off. Enable automatic date & time, then try again.";
    case 15:
      return "License key format is invalid. Check .env.local for copy/paste errors or extra spaces.";
    case 16:
      return "License has expired. Renew it in the Eyedid console.";
    default:
      return `Eyedid initialization failed (code: ${code}). Check license type, network, and clock.`;
  }
}
