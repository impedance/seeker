#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import re

class CORSProxy(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            xquery = body.decode()
            
            # Используем basex напрямую для выполнения запроса
            proc = subprocess.run(
                ['./basex/bin/basex'],
                input=f'OPEN gesnmr\n{xquery}\n'.encode(),
                capture_output=True,
                timeout=30,
                cwd='/home/spec/work/seeker'
            )
            
            output = proc.stdout.decode()
            
            # Вытаскиваем только результаты, убираем prompt и служебный текст
            lines = output.split('\n')
            result_lines = []
            in_result = False
            
            for line in lines:
                # Пропускаем prompt и служебные сообщения
                if line.startswith('>') or 'Database' in line or 'executed in' in line:
                    continue
                # Берём строки с XML тегами
                if line.strip() and ('<' in line or in_result):
                    result_lines.append(line)
                    in_result = True
            
            result = '\n'.join(result_lines).strip()
            
            self.send_response(200)
            self.send_header('Content-type', 'text/xml; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(result.encode() if result else b'<root/>')
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
    
    def log_message(self, format, *args):
        pass  # Отключить логирование

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8888), CORSProxy)
    print('Proxy запущен на http://localhost:8888', flush=True)
    server.serve_forever()
