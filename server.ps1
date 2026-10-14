# Shimo Shanhe - tiny local static server (no Node / Python needed)
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1
param([int]$Port = 8123)

$root = $PSScriptRoot
$CRLF = [string][char]13 + [string][char]10

function Get-Mime([string]$ext) {
  switch ($ext) {
    '.html' { return 'text/html; charset=utf-8' }
    '.css'  { return 'text/css; charset=utf-8' }
    '.js'   { return 'application/javascript; charset=utf-8' }
    '.jpg'  { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.png'  { return 'image/png' }
    '.json' { return 'application/json; charset=utf-8' }
    default { return 'application/octet-stream' }
  }
}

$server = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$server.Start()
Write-Host ('Server is running: http://localhost:' + $Port + '/   (Ctrl+C to stop)')

while ($true) {
  $client = $server.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $requestLine = $reader.ReadLine()
    while ($true) { $h = $reader.ReadLine(); if ($h -eq $null -or $h -eq '') { break } }

    $path = '/'
    if ($requestLine) {
      $parts = $requestLine.Split([char]32)
      if ($parts.Length -ge 2) { $path = $parts[1] }
    }
    $path = $path.Split([char]63)[0].TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $full = Join-Path $root $path
    $full = $full.Replace('/', [System.IO.Path]::DirectorySeparatorChar)

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ct = Get-Mime ([System.IO.Path]::GetExtension($full).ToLower())
      $head = 'HTTP/1.1 200 OK' + $CRLF + 'Content-Type: ' + $ct + $CRLF +
              'Content-Length: ' + $bytes.Length + $CRLF +
              'Cache-Control: no-store' + $CRLF + 'Connection: close' + $CRLF + $CRLF
      $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($hb, 0, $hb.Length)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush()
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $head = 'HTTP/1.1 404 Not Found' + $CRLF + 'Content-Type: text/plain; charset=utf-8' + $CRLF +
              'Content-Length: ' + $body.Length + $CRLF + 'Connection: close' + $CRLF + $CRLF
      $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($hb, 0, $hb.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    }
  } catch { }
  finally { $client.Close() }
}
