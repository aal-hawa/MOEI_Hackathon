@echo off
set ACTION=%1
if "%ACTION%"=="" set ACTION=all

if "%ACTION%"=="install" goto install
if "%ACTION%"=="reinstall" goto reinstall
if "%ACTION%"=="clean" goto clean
if "%ACTION%"=="fclean" goto fclean
if "%ACTION%"=="run" goto run
if "%ACTION%"=="all" goto all

echo ❌ Unknown argument: %ACTION%
echo Usage: .\setup.bat [install^|reinstall^|clean^|fclean^|run^|all]
exit /b 1

:install
echo 📦 Installing dependencies...
call npm install
echo 📦 Installing worker service dependencies...
cd mini-services\worker-service
call bun install
cd ..\..
goto end

:reinstall
echo 🗑️ Removing node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
echo 📦 Re-installing dependencies...
call npm install
echo 🗑️ Removing worker service node_modules...
cd mini-services\worker-service
if exist node_modules rmdir /s /q node_modules
if exist bun.lock del /q bun.lock
echo 📦 Re-installing worker service dependencies...
call bun install
cd ..\..
goto end

:clean
echo 🧹 Cleaning project (removing .next build)...
if exist .next rmdir /s /q .next
echo ✅ Cleaned.
goto end

:fclean
echo 🔥 Full clean (removing modules, build, db, and env)...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
if exist .next rmdir /s /q .next
if exist .env del /q .env
if exist dev.db del /q dev.db
echo ✅ Full clean complete.
goto end

:run
echo 🚀 Starting worker service...
start cmd /c "cd mini-services\worker-service && bun run dev"
echo 🚀 Starting development server...
call npm run dev
goto end

:all
echo =========================================
echo 🚀 Starting full setup process...
echo =========================================

echo.
echo 📦 Installing dependencies...
call npm install
echo 📦 Installing worker service dependencies...
cd mini-services\worker-service
call bun install
cd ..\..

echo.
echo ⚙️ Setting up environment variables...
if not exist .env (
    copy .env.example .env
    echo ✅ Copied .env.example to .env.
) else (
    echo ✅ .env file already exists.
)

echo.
echo 🎉 Setup complete! Starting the development servers...
echo 🚀 Starting worker service...
start cmd /c "cd mini-services\worker-service && bun run dev"
echo 🚀 Starting development server...
call npm run dev
goto end

:end
