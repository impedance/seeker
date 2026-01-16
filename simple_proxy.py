#!/usr/bin/env python3
import base64
import json
import os
import socket
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler


BASEX_HOST = os.getenv("BASEX_HOST", "localhost")
BASEX_PORT = int(os.getenv("BASEX_PORT", "8984"))
PROXY_PORT = int(os.getenv("PROXY_PORT", "8888"))
PROXY_HOST = os.getenv("PROXY_HOST", "::")
BASEX_AUTH = os.getenv("BASEX_AUTH")  # full value e.g. "Basic dXNlcjpwYXNz"
BASEX_USER = os.getenv("BASEX_USER")
BASEX_PASSWORD = os.getenv("BASEX_PASSWORD")


class CORSProxy(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Access-Control-Max-Age", "600")

    def _forward(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""
        target_url = f"http://{BASEX_HOST}:{BASEX_PORT}{self.path}"

        # Передаём только нужные заголовки; Authorization приходит из фронта.
        headers = {}
        for key in ("Content-Type", "Authorization"):
            if key in self.headers:
                headers[key] = self.headers[key]
        if "Authorization" not in headers:
            auth = BASEX_AUTH
            if not auth and BASEX_USER and BASEX_PASSWORD:
                token = base64.b64encode(f"{BASEX_USER}:{BASEX_PASSWORD}".encode("utf-8")).decode("ascii")
                auth = f"Basic {token}"
            if auth:
                headers["Authorization"] = auth

        req = urllib.request.Request(
            target_url,
            data=body if self.command != "OPTIONS" else None,
            headers=headers,
            method=self.command,
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                status = resp.status
                content_type = resp.headers.get("Content-Type", "text/xml; charset=utf-8")
        except Exception as exc:
            status = 502
            content_type = "application/json"
            resp_body = json.dumps({"error": str(exc)}).encode()

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(resp_body)

    def do_POST(self):
        self._forward()

    def do_GET(self):
        self._forward()

    def do_HEAD(self):
        self._forward()

    def do_OPTIONS(self):
        # CORS preflight; фактически не ходим в BaseX.
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Тишина в консоли


if __name__ == "__main__":
    class DualStackHTTPServer(HTTPServer):
        address_family = socket.AF_INET6

        def server_bind(self):
            try:
                self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            except OSError:
                pass
            return super().server_bind()

    try:
        server = DualStackHTTPServer((PROXY_HOST, PROXY_PORT), CORSProxy)
    except OSError:
        server = HTTPServer(("127.0.0.1", PROXY_PORT), CORSProxy)
        PROXY_HOST = "127.0.0.1"

    print(f"Proxy запущен на http://{PROXY_HOST}:{PROXY_PORT} -> http://{BASEX_HOST}:{BASEX_PORT}", flush=True)
    server.serve_forever()
