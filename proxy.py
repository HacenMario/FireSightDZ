import sys
import urllib.request
import urllib.parse
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

# Fix encoding for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        match = re.match(r'^/proxy/(.+)', self.path)
        if not match:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing target URL after /proxy/')
            return

        target_url = urllib.parse.unquote(match.group(1))
        print(f'[Proxy] Fetching: {target_url}')

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
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            error_msg = f'Proxy error: {str(e)}'
            self.wfile.write(error_msg.encode())
            print(f'[Proxy] Error: {error_msg}')

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8080), ProxyHandler)
    print('[Proxy] Server running on http://localhost:8080')
    print('[Proxy] Use: http://localhost:8080/proxy/URL_ENCODE')
    server.serve_forever()