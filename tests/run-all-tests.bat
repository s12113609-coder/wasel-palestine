@echo off
echo ====================================
echo   Wasel Palestine - k6 Load Tests
echo ====================================

echo.
echo [1/5] Read-Heavy Test...
k6 run --out json=results/01-read-heavy.json 01-read-heavy.js

echo.
echo [2/5] Write-Heavy Test...
k6 run --out json=results/02-write-heavy.json 02-write-heavy.js

echo.
echo [3/5] Mixed Workload Test...
k6 run --out json=results/03-mixed.json 03-mixed.js

echo.
echo [4/5] Spike Test...
k6 run --out json=results/04-spike.json 04-spike.js

echo.
echo [5/5] Soak Test (24 min - be patient)...
k6 run --out json=results/05-soak.json 05-soak.js

echo.
echo ====================================
echo   All tests completed!
echo   Results saved in /results folder
echo ====================================
pause
