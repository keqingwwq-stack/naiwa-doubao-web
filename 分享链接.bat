@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   《奶娃与豆包》网页版 - 生成一个可以发给别人的公网链接
echo ============================================================
echo.

if not exist cloudflared.exe (
  echo 首次使用，正在下载 cloudflared（约 53 MB，只需一次）...
  curl -L -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  if not exist cloudflared.exe (
    echo 下载失败，请手动下载后放到本文件夹：
    echo https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    pause
    exit /b 1
  )
)

echo 正在启动本地服务器...
start "" /min python serve.py --port 8123 --no-browser
timeout /t 2 >nul

echo.
echo ------------------------------------------------------------
echo  下面日志里 https://xxxx.trycloudflare.com 那一行就是分享链接
echo  把它发给别人，对方用浏览器直接打开就能玩
echo  这个窗口不要关；关掉或电脑睡眠，链接就失效了
echo ------------------------------------------------------------
echo.

cloudflared.exe tunnel --url http://127.0.0.1:8123 --no-autoupdate
pause
