import http.server
import socketserver
import webbrowser
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")

def main():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print("=" * 60)
        print("   CONVERT TEMPLATE - CÔNG CỤ CHUYỂN ĐỔI PO SANG NHẬP HÀNG")
        print("=" * 60)
        print(f" Đang mở trình duyệt tại: {url}")
        print(" Nhấn Ctrl + C để dừng máy chủ.")
        print("=" * 60)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nĐã tắt máy chủ.")

if __name__ == "__main__":
    main()
