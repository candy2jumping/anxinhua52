@echo off
chcp 65001 >nul
cd /d "C:\Users\Lenovo\WorkBuddy\2026-08-31-16-01-04\easybudget"
echo ============================================
echo   安心花 本地预览服务器
echo   本机打开:  http://127.0.0.1:8080
echo   手机打开:  用本机WiFi的IPv4地址 + :8080
echo   （查地址: 开始菜单搜 cmd 输 ipconfig 看 WLAN 的 IPv4）
echo   关闭窗口即停止服务器
echo ============================================
"C:\Users\Lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m http.server 8080 --bind 0.0.0.0
pause
