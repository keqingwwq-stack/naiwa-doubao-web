@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 奶娃与豆包 - 网页版

where python >nul 2>nul
if %errorlevel%==0 (
    python serve.py %*
    goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 serve.py %*
    goto :end
)

echo.
echo 没找到 Python，无法启动本地服务器。
echo.
echo 三个办法：
echo   1. 装一个 Python（python.org，安装时勾选 Add to PATH），再双击本文件；
echo   2. 把这个文件夹上传到任意静态网站空间（GitHub Pages / Netlify / 自己的服务器），
echo      直接访问网址即可，不需要 Python；
echo   3. 详见同目录的《网页版说明.md》。
echo.
pause

:end
