param(
  [string]$RepoRoot = "D:\trpg",
  [string]$WatchPath = "D:\trpg\大梁武侠",
  [int]$DebounceSeconds = 180,
  [int]$PollSeconds = 5
)

$ErrorActionPreference = "Continue"
$logPath = Join-Path $RepoRoot ".git\auto_git_backup.log"
$lastChange = Get-Date
$pending = $true

function Write-BackupLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $logPath -Value "[$timestamp] $Message"
}

function Invoke-GitBackup {
  Push-Location $RepoRoot
  try {
    $status = git status --porcelain
    if (-not $status) {
      Write-BackupLog "No changes to commit."
      return
    }

    git add -A | Out-Null
    $statusAfterAdd = git status --porcelain
    if (-not $statusAfterAdd) {
      Write-BackupLog "No staged changes after add."
      return
    }

    $message = "自动备份 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $message | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-BackupLog "Commit failed with exit code $LASTEXITCODE."
      return
    }

    git push | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-BackupLog "Pushed: $message"
    } else {
      Write-BackupLog "Push failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $WatchPath -PathType Container)) {
  Write-BackupLog "Watch path does not exist: $WatchPath"
  exit 1
}

Write-BackupLog "Auto git backup started. WatchPath=$WatchPath DebounceSeconds=$DebounceSeconds"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $WatchPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$action = {
  $script:lastChange = Get-Date
  $script:pending = $true
}

$created = Register-ObjectEvent $watcher Created -Action $action
$changed = Register-ObjectEvent $watcher Changed -Action $action
$deleted = Register-ObjectEvent $watcher Deleted -Action $action
$renamed = Register-ObjectEvent $watcher Renamed -Action $action

try {
  while ($true) {
    Start-Sleep -Seconds $PollSeconds
    if ($pending -and ((Get-Date) - $lastChange).TotalSeconds -ge $DebounceSeconds) {
      $pending = $false
      Invoke-GitBackup
    }
  }
} finally {
  Unregister-Event -SubscriptionId $created.Id
  Unregister-Event -SubscriptionId $changed.Id
  Unregister-Event -SubscriptionId $deleted.Id
  Unregister-Event -SubscriptionId $renamed.Id
  $watcher.Dispose()
  Write-BackupLog "Auto git backup stopped."
}
