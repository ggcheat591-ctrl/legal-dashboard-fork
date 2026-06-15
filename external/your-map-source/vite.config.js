import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function setBrowserHeaders(proxy) {
  proxy.on("proxyReq", (proxyReq) => {
    proxyReq.setHeader(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    proxyReq.setHeader("Accept", "application/json,image/png,text/plain,*/*");
    proxyReq.setHeader("Accept-Language", "ru-RU,ru;q=0.9,en;q=0.8");
  });

  proxy.on("proxyRes", (proxyRes, req) => {
    if (req.url?.includes("/wms") && !proxyRes.headers["content-type"]) {
      proxyRes.headers["content-type"] = "image/png";
    }
  });

  proxy.on("error", (err, req, res) => {
    console.error("Proxy error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Proxy error: " + err.message);
  });
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/nspd": {
        target: "https://nspd.gov.ru",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/nspd/, ""),
        configure: (proxy) => {
          setBrowserHeaders(proxy);
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Host", "nspd.gov.ru");
            proxyReq.setHeader("Referer", "https://nspd.gov.ru/map");
            proxyReq.setHeader("Origin", "https://nspd.gov.ru");
          });
        }
      },
      "/fg": {
        target: "https://fg.avto-spory.ru",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/fg/, ""),
        configure: (proxy) => {
          setBrowserHeaders(proxy);
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Origin", "https://rosreestor-russia.ru");
            proxyReq.setHeader("Referer", "https://rosreestor-russia.ru/");
          });
        }
      },
      "/pkk": {
        target: "https://pkk5.rosreestr.ru",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/pkk/, ""),
        configure: setBrowserHeaders
      },
      "/pkkros": {
        target: "https://pkk.rosreestr.ru",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/pkkros/, ""),
        configure: setBrowserHeaders
      },
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
        configure: (proxy) => {
          setBrowserHeaders(proxy);
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Host", "nominatim.openstreetmap.org");
            proxyReq.setHeader("Referer", "http://localhost:5173/");
            proxyReq.setHeader("Accept", "application/json,text/plain,*/*");
          });
        }
      }
    }
  }
});
