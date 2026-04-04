@echo off
title Strudel Mobile REPL
echo.
echo  ==============================
echo   Strudel Mobile REPL Server
echo  ==============================
echo.
echo  Opening http://localhost:8080
echo  Press Ctrl+C to stop
echo.
start http://localhost:8080
python -m http.server 8080
pause
