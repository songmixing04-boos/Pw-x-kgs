import { createFileRoute } from "@tanstack/react-router";

// Switches the visitor to the PW x Ankit Chaudhary site (cookie-based mode).
const COOKIE = "site_mode=pw; Path=/; Max-Age=31536000; SameSite=None; Secure";

export const Route = createFileRoute("/pw")({
  server: {
    handlers: {
      GET: () =>
        new Response(null, {
          status: 302,
          headers: { "Set-Cookie": COOKIE, Location: "/" },
        }),
    },
  },
});
