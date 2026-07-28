import sys
import urllib.request
import urllib.parse
import re
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

# ضبط الترميز
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # استخراج الرابط المستهدف
        match = re.match(r'^/proxy/(.+)', self.path)
        if not match:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing target URL after /proxy/')
            return

        target_url = urllib.parse.unquote(match.group(1))
        print(f'[Proxy] Fetching: {target_url[:80]}...')

        try:
            req = urllib.request.Request(target_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                content = response.read()
                self.send_response(response.status)
                content_type = response.headers.get('Content-Type', 'text/plain')
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
                print(f'[Proxy] ✅ Success ({len(content)} bytes)')
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            error_msg = f'Proxy error: {str(e)}'
            self.wfile.write(error_msg.encode())
            print(f'[Proxy] ❌ Error: {error_msg}')

    def log_message(self, format, *args):
        # تقليل السجلات المزعجة
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = HTTPServer(('0.0.0.0', port), ProxyHandler)
    print(f'[Proxy] Server running on port {port}')
    server.serve_forever()
