#!/usr/bin/env python3
"""Local dev server with SPA fallback.

`npx serve . -s` is the README's suggestion, but if npm/npx isn't set up
(or its cache is unwritable), this does the same job with just Python:
serve every real file as-is, and fall back to index.html for unmatched
paths so deep links like /gen/3 load on a fresh visit — the same thing
404.html / _redirects do in production.

    python serve.py            # http://127.0.0.1:5500/
    python serve.py 8000       # pick a port
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not self.path.startswith("/api/"):
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        # No caching in dev, so an edit shows on the next reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"IQ Bible App — http://127.0.0.1:{PORT}/  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
