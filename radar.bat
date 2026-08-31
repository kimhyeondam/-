@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 현장 레이더
py tools\site_radar\radar.py %*
echo.
pause
