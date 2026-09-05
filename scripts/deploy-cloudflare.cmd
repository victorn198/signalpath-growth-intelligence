@echo off
setlocal
set "ROOT=%~dp0.."
set "HOME=D:\projects\.cloudflare-home"
set "USERPROFILE=D:\projects\.cloudflare-home"
set "XDG_CONFIG_HOME=D:\projects\.cloudflare-home"
set "npm_config_cache=%ROOT%\.npm-cache"
if not exist "%HOME%" mkdir "%HOME%"
cd /d "%ROOT%"
call npm run build || exit /b 1
call node_modules\.bin\wrangler.cmd pages deploy dist --project-name=signalpath-growth-intelligence --branch=main --commit-dirty=true
