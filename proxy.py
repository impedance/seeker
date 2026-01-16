#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
import json

class CORSProxy(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        # Убираем /proxy префикс и строим URL к BaseX
        basex_url = f"http://localhost:9090{self.path.replace('/proxy', '')}"
        
        try:
            response = requests.post(
                basex_url,
                data=body,
                headers={'Content-Type': 'application/xml'},
                auth=('admin', 'admin'),
                timeout=30
            )
            
            self.send_response(response.status_code)
            self.send_header('Content-type', 'text/xml')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.content)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8888), CORSProxy)
    print('CORS Proxy запущен на http://localhost:8888')
    server.serve_forever()
