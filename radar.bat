@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 현장 레이더
echo.
echo   최신 버전 확인 중...
git pull --ff-only >nul 2>&1
if errorlevel 1 (echo   업데이트를 건너뜁니다. 현재 버전으로 진행합니다.) else (echo   최신 상태입니다.)
py tools\site_radar\radar.py %*
echo.
pause
