# -*- coding: utf-8 -*-
"""
《奶娃与豆包》网页版本地服务器。

用法：
    python serve.py            # 只在本机打开 http://127.0.0.1:8080
    python serve.py --lan      # 同一 WiFi 下的手机/电脑也能访问（会打印局域网地址）
    python serve.py --port 9000

网页版必须通过 http 访问（直接双击 index.html 打不开），所以用这个脚本起一个
带正确 MIME 和跨域隔离响应头的小服务器。
"""

import argparse
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".data": "application/octet-stream",
        ".zip": "application/zip",
        ".json": "application/json",
        ".ogg": "audio/ogg",
        ".webp": "image/webp",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }

    def end_headers(self):
        # Ren'Py 网页版需要跨域隔离（SharedArrayBuffer），这三个头必须带。
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 只在出错时打印，避免刷屏
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--lan", action="store_true", help="允许局域网访问")
    ap.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    args = ap.parse_args()

    os.chdir(ROOT)
    host = "0.0.0.0" if args.lan else "127.0.0.1"

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    handler = lambda *a, **kw: Handler(*a, directory=ROOT, **kw)  # noqa: E731
    with Server((host, args.port), handler) as httpd:
        local = "http://127.0.0.1:%d/" % args.port
        print("《奶娃与豆包》网页版已启动")
        print("  本机访问：%s" % local)
        if args.lan:
            ip = lan_ip()
            if ip:
                print("  局域网访问：http://%s:%d/" % (ip, args.port))
        print("按 Ctrl+C 停止。")
        if not args.no_browser:
            threading.Timer(0.8, lambda: webbrowser.open(local)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止。")


if __name__ == "__main__":
    main()
