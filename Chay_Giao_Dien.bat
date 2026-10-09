@echo off
chcp 65001 >nul
title Chuyển Đổi PO Sang File Nhập Hàng
cd /d "%~dp0"

echo ========================================================
echo   CÔNG CỤ CHUYỂN ĐỔI PO SANG FILE NHẬP HÀNG
echo ========================================================
echo.
echo Đang khởi động giao diện web trên trình duyệt...
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    python server.py
) else (
    start "" "index.html"
)
pause
