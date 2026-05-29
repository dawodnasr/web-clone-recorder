import http.server, socketserver, os, urllib.parse, sys, mimetypes, re
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 8013
ROOT=os.path.dirname(os.path.abspath(__file__))
mimetypes.add_type('application/javascript','.js'); mimetypes.add_type('audio/ogg','.opus')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=ROOT,**k)
    def translate(self):
        path=urllib.parse.urlparse(self.path).path
        path=urllib.parse.unquote(path)
        fs=os.path.join(ROOT, path.lstrip('/').replace('/',os.sep))
        return path, fs
    def do_GET(self):
        path,fs=self.translate()
        if path!='/' and not os.path.isfile(fs):
            fs=os.path.join(ROOT,'index.html')                 # SPA fallback
        self.serve(fs, head=False)
    def do_HEAD(self):
        path,fs=self.translate()
        if path!='/' and not os.path.isfile(fs): fs=os.path.join(ROOT,'index.html')
        self.serve(fs, head=True)
    def serve(self, fs, head):
        if os.path.isdir(fs): fs=os.path.join(fs,'index.html')
        if not os.path.isfile(fs): self.send_error(404); return
        ctype=self.guess_type(fs); size=os.path.getsize(fs)
        rng=self.headers.get('Range')
        start=0; end=size-1; status=200
        if rng:
            m=re.match(r'bytes=(\d*)-(\d*)', rng)
            if m:
                if m.group(1): start=int(m.group(1))
                if m.group(2): end=int(m.group(2))
                status=206
        length=end-start+1
        self.send_response(status)
        self.send_header('Content-Type',ctype)
        self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Length',str(length))
        if status==206: self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Access-Control-Allow-Origin','*')
        self.end_headers()
        if head: return
        with open(fs,'rb') as f:
            f.seek(start); remaining=length
            while remaining>0:
                chunk=f.read(min(65536,remaining))
                if not chunk: break
                try: self.wfile.write(chunk)
                except (BrokenPipeError,ConnectionResetError): break
                remaining-=len(chunk)
    def log_message(self,*a): pass

class TS(socketserver.ThreadingTCPServer): daemon_threads=True; allow_reuse_address=True
with TS(("127.0.0.1",PORT),H) as httpd:
    print(f"SPA+Range server on http://127.0.0.1:{PORT}/ root={ROOT}")
    httpd.serve_forever()
