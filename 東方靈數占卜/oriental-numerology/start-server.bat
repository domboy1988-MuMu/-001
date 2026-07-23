@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  正在啟動本機伺服器...
echo  啟動後請用瀏覽器打開： http://localhost:8000/demo.html
echo  要關閉伺服器請按 Ctrl+C
echo.
py -m http.server 8000 2>nul || python -m http.server 8000 2>nul || (
  echo  找不到 Python。請改用其他方式，或安裝 Python 後再試。
  pause
)
