# -*- coding: utf-8 -*-
"""start.bat / build_db.bat を CRLF + CP932 で生成する"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def write_bat(name: str, lines: list[str]) -> None:
    text = "\r\n".join(lines) + "\r\n"
    (ROOT / name).write_bytes(text.encode("cp932"))

start_lines = [
    "@echo off",
    "chcp 932 >nul",
    'cd /d "%~dp0"',
    "",
    "echo ========================================",
    "echo   ねらいうちゲーム - ローカル起動",
    "echo ========================================",
    "echo.",
    "echo   ブラウザで次のURLを開いてください:",
    "echo   http://localhost:8766",
    "echo.",
    "echo   終了するにはこのウィンドウで Ctrl+C を押してください。",
    "echo.",
    'start "" cmd /c "timeout /t 2 /nobreak >nul ^&^& start http://localhost:8766"',
    "",
    "where python >nul 2>&1",
    "if %errorlevel% equ 0 (",
    "  python -m http.server 8766",
    "  goto :end",
    ")",
    "",
    "where npx >nul 2>&1",
    "if %errorlevel% equ 0 (",
    "  npx --yes serve -l 8766",
    "  goto :end",
    ")",
    "",
    "echo [エラー] Python または Node.js が見つかりません。",
    "echo Python: https://www.python.org/",
    "echo Node.js: https://nodejs.org/",
    "pause",
    "exit /b 1",
    "",
    ":end",
    "pause",
]

build_lines = [
    "@echo off",
    "chcp 932 >nul",
    'cd /d "%~dp0"',
    "",
    "echo ========================================",
    "echo   ねらいうちゲーム - データベース更新",
    "echo ========================================",
    "echo.",
    "",
    "where python >nul 2>&1",
    "if %errorlevel% neq 0 (",
    "  echo [エラー] Python が見つかりません。",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    "python scripts\\build_data.py",
    "if %errorlevel% neq 0 (",
    "  echo [エラー] ビルドに失敗しました。",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    "echo.",
    "echo ビルド完了。",
    "pause",
]

write_bat("start.bat", start_lines)
write_bat("build_db.bat", build_lines)
print("OK: start.bat, build_db.bat (CRLF + CP932)")
