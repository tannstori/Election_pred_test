# Løgtingsval 2026 Live Nowcast Update Loop
# Same workflow as Fólkatingsval, adapted for logtingsval election family

$ErrorActionPreference = "Stop"

$PROJ = "C:\main_repo\Freedom_prog"
$PUB  = "C:\main_repo\Freedom_site_public"
$PY   = "$PROJ\.venv\Scripts\python.exe"
$DRAWS = "$PROJ\artifacts\b0_weakprior_dim2_20260326_165736\draws"
$SITE_SRC = "$PROJ\dashboard\site\_site"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$StepName
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$StepName failed with exit code $LASTEXITCODE"
  }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Løgtingsval 2026 Live Nowcast Engine" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project: $PROJ" -ForegroundColor Gray
Write-Host "Public repo: $PUB" -ForegroundColor Gray
Write-Host "Posterior draws: $DRAWS" -ForegroundColor Gray
Write-Host "Website source: $SITE_SRC" -ForegroundColor Gray
Write-Host ""

if (-not (Get-Command quarto -ErrorAction SilentlyContinue)) {
  throw "quarto command not found in PATH; install Quarto or add it to PATH"
}

while ($true) {
  try {
    Write-Host ""
    Write-Host "=== Live update start: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" -ForegroundColor Green

    # CRITICAL: Set working directory to workspace root
    Set-Location $PROJ
    $env:PYTHONPATH = "src"

    # 1) Fast live ingestion (skips if unchanged)
    Write-Host "[1/4] Fetching live data from KVF..." -ForegroundColor Yellow
    Invoke-Checked -StepName "phase1 ingest-live-fast" -Command {
      & $PY -m freedom_nowcast.runner.cli phase1 ingest-live-fast
    }

    # 2) Build dedicated with-polls nowcast snapshot for website poll page
    Write-Host "[2/4] Running with-polls nowcast snapshot..." -ForegroundColor Yellow
    Invoke-Checked -StepName "phase4 run (with polls)" -Command {
      & $PY -m freedom_nowcast.runner.cli phase4 run `
        --election-family logtingsval `
        --posterior-draws-dir "$DRAWS" `
        --turnout-overrides-file "$PROJ\config\live_turnout_overrides.csv"
    }

    Copy-Item "$PROJ\reports\live_nowcast_report.json" "$PROJ\reports\live_nowcast_report_with_polls.json" -Force

    # 3) Update primary nowcast in no-polls production mode
    Write-Host "[3/4] Running production nowcast (no polls)..." -ForegroundColor Yellow
    Invoke-Checked -StepName "phase4 run (no polls)" -Command {
      & $PY -m freedom_nowcast.runner.cli phase4 run `
        --election-family logtingsval `
        --posterior-draws-dir "$DRAWS" `
        --turnout-overrides-file "$PROJ\config\live_turnout_overrides.csv" `
        --no-use-polls
    }

    # 4) Rebuild dashboard payload
    Write-Host "[4/4] Building dashboard data..." -ForegroundColor Yellow
    Invoke-Checked -StepName "phase4 dashboard-data" -Command {
      & $PY -m freedom_nowcast.runner.cli phase4 dashboard-data
    }

    # 5) Render full website
    Write-Host "[5/6] Rendering website..." -ForegroundColor Yellow
    Invoke-Checked -StepName "quarto render" -Command {
      Set-Location "$PROJ\dashboard\site"
      quarto render
    }

    if (-not (Test-Path $SITE_SRC)) {
      throw "Rendered website directory missing: $SITE_SRC"
    }

    # 6) Sync website and payload to public repo
    Write-Host "[6/6] Syncing website to public repository..." -ForegroundColor Cyan
    Copy-Item "$SITE_SRC\*" "$PUB\" -Recurse -Force

    $srcPayload = "$PROJ\docs\dashboard\data\dashboard_payload.json"
    $dstPayload = "$PUB\data\dashboard_payload.json"

    if (-not (Test-Path $srcPayload)) {
      throw "Source payload missing: $srcPayload"
    }

    $srcHash = (Get-FileHash -Path $srcPayload -Algorithm SHA256).Hash
    Copy-Item $srcPayload $dstPayload -Force
    if (-not (Test-Path $dstPayload)) {
      throw "Destination payload missing after copy: $dstPayload"
    }
    $dstHash = (Get-FileHash -Path $dstPayload -Algorithm SHA256).Hash
    Write-Host "Payload hash src=$srcHash dst=$dstHash" -ForegroundColor DarkGray
    if ($srcHash -ne $dstHash) {
      throw "Payload copy verification failed: source and destination hashes differ"
    }

    # 7) Commit/push website changes with explicit git error handling
    if (-not (Test-Path "$PUB\.git")) {
      throw "Public path is not a git repository: $PUB"
    }

    $branch = (git -C $PUB branch --show-current).Trim()
    if ([string]::IsNullOrWhiteSpace($branch)) {
      $branch = "main"
    }

    git -C $PUB add -A
    if ($LASTEXITCODE -ne 0) {
      throw "git add failed"
    }

    $staged = git -C $PUB diff --cached --name-only
    if ($LASTEXITCODE -ne 0) {
      throw "git diff --cached failed"
    }

    if ([string]::IsNullOrWhiteSpace(($staged | Out-String).Trim())) {
      Write-Host "✓ No website/payload change. Skipping commit/push." -ForegroundColor Gray
    }
    else {
      $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
      git -C $PUB commit -m "Live website update $stamp"
      if ($LASTEXITCODE -ne 0) {
        throw "git commit failed (check git user identity or repository state)"
      }

      git -C $PUB push origin $branch
      if ($LASTEXITCODE -ne 0) {
        Write-Host "Push rejected; attempting rebase+retry..." -ForegroundColor Yellow
        git -C $PUB pull --rebase --autostash origin $branch
        if ($LASTEXITCODE -ne 0) {
          throw "git pull --rebase --autostash failed (resolve conflicts, then restart loop)"
        }

        git -C $PUB push origin $branch
        if ($LASTEXITCODE -ne 0) {
          throw "git push failed after rebase (check auth/permissions/network)"
        }
      }

      Write-Host "✓ Pushed live website update to origin/$branch." -ForegroundColor Green
    }

    Write-Host "=== Update cycle complete: $(Get-Date -Format 'HH:mm:ss') ===" -ForegroundColor Green
  }
  catch {
    Write-Host "✗ Update cycle failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack: $($_.ScriptStackTrace)" -ForegroundColor Red
  }

  Write-Host "Sleeping 120 seconds until next refresh..." -ForegroundColor Gray
  Start-Sleep -Seconds 120
}
