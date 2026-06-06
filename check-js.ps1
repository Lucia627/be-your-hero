$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$jsDir = Join-Path $scriptDir "frontend" "js"
$files = @('api.js', 'ui.js', 'cards.js', 'camera.js', 'battle.js', 'main.js')

foreach ($f in $files) {
    $path = Join-Path $jsDir $f
    if (Test-Path $path) {
        Write-Host "=== $f ==="
        node --check "$path" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Syntax check failed for $f"
        }
    } else {
        Write-Warning "File not found: $path"
    }
}
