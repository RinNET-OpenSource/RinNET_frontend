$log = 'C:\Users\rin\Documents\aqua_viewer_revived\scripts\add-hosts.log'
$out = @()
$hostsPath = 'C:\Windows\System32\drivers\etc\hosts'
$entry = '127.0.0.1 portal.naominet.live'

function Try-Step($name, $script) {
  try { & $script | Out-Null; $script:out += "$name : OK"; return $true }
  catch { $script:out += "$name : FAIL $($_.Exception.Message)"; return $false }
}

# 0) 只读属性检查
$out += "attrib: $((attrib $hostsPath) -join ' ')"

# 1) 清除只读/系统属性
Try-Step 'attrib-clear' { attrib -r -s $hostsPath }

# 2) 显式授权
Try-Step 'icacls-grant' { icacls $hostsPath /grant 'Administrators:F' | Out-Null }

# 3) 目标行（读取当前内容，规范化）
$lines = @(Get-Content -Path $hostsPath -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch 'portal\.naominet\.live' -and $_ -notmatch '^`n127' })
$lines += $entry

# 4) 依次尝试三种写入方式
$ok = Try-Step 'set-content' { Set-Content -Path $hostsPath -Value $lines -Encoding ascii }
if (-not $ok) {
  $tmp = "$env:TEMP\hosts.new"
  Set-Content -Path $tmp -Value $lines -Encoding ascii
  $ok = Try-Step 'move-item' { Move-Item -Path $tmp -Destination $hostsPath -Force }
}
if (-not $ok) {
  $ok = Try-Step 'cmd-append' { cmd /c "echo $entry>> $hostsPath" }
}

# 5) 验证
$final = Select-String -Path $hostsPath -Pattern '^\s*127\.0\.0\.1\s+portal\.naominet\.live' -ErrorAction SilentlyContinue
$out += "final-check: $(if ($final) { 'PRESENT' } else { 'MISSING' })"
$out | Out-File -FilePath $log -Encoding utf8
