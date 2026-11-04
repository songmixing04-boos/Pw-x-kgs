import { createFileRoute } from "@tanstack/react-router";

// Switches the visitor back to the KGS (Ankit Chaudhary X KGS Batches) site.
const COOKIE = "site_mode=kgs; Path=/; Max-Age=31536000; SameSite=None; Secure";

export const Route = createFileRoute("/kgs")({
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
