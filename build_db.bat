@echo off
chcp 932 >nul
cd /d "%~dp0"

echo ========================================
echo   ねらいうちゲーム - データベース更新
echo ========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
  echo [エラー] Python が見つかりません。
  pause
  exit /b 1
)

python scripts\build_data.py
if %errorlevel% neq 0 (
  echo [エラー] ビルドに失敗しました。
  pause
  exit /b 1
)

echo.
echo ビルド完了。
pause
