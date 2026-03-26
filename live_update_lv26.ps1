# Løgtingsval 2026 Live Nowcast Update Loop
# Same workflow as Fólkatingsval, adapted for logtingsval election family

$ErrorActionPreference = "Stop"

$PROJ = "C:\main_repo\Freedom_prog"
$PUB  = "C:\main_repo\Freedom_site_public"
$PY   = "$PROJ\.venv\Scripts\python.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Løgtingsval 2026 Live Nowcast Engine" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project: $PROJ" -ForegroundColor Gray
Write-Host "Public repo: $PUB" -ForegroundColor Gray
Write-Host ""

while ($true) {
  try {
    Write-Host ""
    Write-Host "=== Live update start: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" -ForegroundColor Green

    # CRITICAL: Set working directory to workspace root
    Set-Location $PROJ
    $env:PYTHONPATH = "src"

    # 1) Fast live ingestion (skips if unchanged)
    Write-Host "[1/3] Fetching live data from KVF..." -ForegroundColor Yellow
    & $PY -m freedom_nowcast.runner.cli phase1 ingest-live-fast

    # 2) Update nowcast with logtingsval election family
    Write-Host "[2/3] Running nowcast model (logtingsval)..." -ForegroundColor Yellow
    & $PY -m freedom_nowcast.runner.cli phase4 run `
      --election-family logtingsval `
      --turnout-overrides-file "$PROJ\config\live_turnout_overrides.csv" `
      --no-use-polls

    # 3) Rebuild dashboard payload
    Write-Host "[3/3] Building dashboard data..." -ForegroundColor Yellow
    & $PY -m freedom_nowcast.runner.cli phase4 dashboard-data

    # 4) Copy payload to public repo
    Write-Host "Syncing to public repository..." -ForegroundColor Cyan
    Copy-Item "$PROJ\docs\dashboard\data\dashboard_payload.json" "$PUB\data\dashboard_payload.json" -Force

    # 5) Push only if changed
    Set-Location $PUB
    git add data/dashboard_payload.json
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      Write-Host "✓ No payload change. Skipping commit/push." -ForegroundColor Gray
    } else {
      git commit -m "Live payload update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
      git push origin main
      Write-Host "✓ Pushed live payload update." -ForegroundColor Green
    }

    Write-Host "=== Update cycle complete: $(Get-Date -Format 'HH:mm:ss') ===" -ForegroundColor Green
  }
  catch {
    Write-Host "✗ Update cycle failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack: $($_.ScriptStackTrace)" -ForegroundColor Red
  }

  Write-Host "Sleeping 300 seconds until next refresh..." -ForegroundColor Gray
  Start-Sleep -Seconds 300
}
