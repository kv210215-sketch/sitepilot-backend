[CmdletBinding()]
param(
    [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Log {
    param(
        [ValidateSet('INFO', 'WARN', 'ERROR')]
        [string]$Level,
        [string]$Message
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$timestamp] [$Level] $Message"
}

function Get-ListeningProcess {
    param([int]$TargetPort)

    $connection = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $connection) {
        return $null
    }

    return Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
}

$allowedProcessNames = @('node', 'npm')

Write-Log -Level INFO -Message "Checking listener on port $Port"

$listener = Get-ListeningProcess -TargetPort $Port

if (-not $listener) {
    Write-Log -Level INFO -Message "Port $Port is already free"
    exit 0
}

$processName = $listener.ProcessName.ToLowerInvariant()
Write-Log -Level INFO -Message "Found PID $($listener.Id) ($processName) listening on port $Port"

if ($allowedProcessNames -notcontains $processName) {
    Write-Log -Level WARN -Message "Port $Port is owned by non-dev process '$processName'. No action taken."
    exit 1
}

Write-Log -Level INFO -Message "Requesting stop for PID $($listener.Id) ($processName)"
Stop-Process -Id $listener.Id -ErrorAction Stop

$released = $false
for ($attempt = 1; $attempt -le 10; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (-not (Get-ListeningProcess -TargetPort $Port)) {
        $released = $true
        break
    }
}

if (-not $released) {
    Write-Log -Level WARN -Message "PID $($listener.Id) is still holding port $Port. Escalating to force stop."
    Stop-Process -Id $listener.Id -Force -ErrorAction Stop

    for ($attempt = 1; $attempt -le 10; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (-not (Get-ListeningProcess -TargetPort $Port)) {
            $released = $true
            break
        }
    }
}

if (-not $released) {
    Write-Log -Level ERROR -Message "Port $Port is still in use after stopping PID $($listener.Id)."
    exit 1
}

Write-Log -Level INFO -Message "Port $Port is free"
exit 0