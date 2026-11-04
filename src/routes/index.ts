import { createFileRoute } from "@tanstack/react-router";
import { proxyRequest, resolveSite } from "@/lib/site-proxy.server";

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const site = resolveSite(request);
        return proxyRequest(request, site.id === "pw" ? "/" : "/home", site);
      },
      POST: ({ request }) => {
        const site = resolveSite(request);
        return proxyRequest(request, site.id === "pw" ? "/" : "/home", site);
      },
    },
  },
});
