# Export every slide of every deck in work/plan.json to PNG with PowerPoint,
# plus each slide's text (for search) and the deck's slide size.
# Output: work/png/<id>/NN.png and work/decks/<id>.json
# Usage (from the project root): powershell -File tools/export_slides.ps1 [-Only h001,p27] [-Resume]
param([string[]]$Only = @(), [switch]$Resume)

$ErrorActionPreference = 'Stop'
# -File passes "a,b" as one string
$Only = @($Only | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$root = (Get-Location).Path
$plan = Get-Content -Raw -Encoding UTF8 "$root\work\plan.json" | ConvertFrom-Json
New-Item -ItemType Directory -Force "$root\work\png", "$root\work\decks" | Out-Null

# Returns the slide a shape's click action jumps to, 0 for next/previous/first/last/end,
# or $null when the shape is not a navigation button.
function NavTarget($shape) {
  $act = $null
  try { $act = $shape.ActionSettings.Item(1) } catch { return $null }
  if (-not $act) { return $null }
  if ($act.Action -ge 1 -and $act.Action -le 6) { return 0 }
  if ($act.Action -eq 7 -and -not $act.Hyperlink.Address -and $act.Hyperlink.SubAddress -match '^\d+,(\d+),') { return [int]$Matches[1] }
  return $null
}

$app = New-Object -ComObject PowerPoint.Application
try {
  foreach ($d in $plan) {
    if ($Only.Count -gt 0 -and -not ($Only -contains $d.id)) { continue }
    if ($Resume -and (Test-Path "$root\work\decks\$($d.id).json")) { continue }
    $outDir = "$root\work\png\$($d.id)"
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
    New-Item -ItemType Directory -Force $outDir | Out-Null
    # Open(path, ReadOnly, Untitled, WithWindow)
    $pres = $app.Presentations.Open("$root\source\$($d.file)", -1, 0, 0)
    try {
      $w = $pres.PageSetup.SlideWidth
      $h = $pres.PageSetup.SlideHeight
      $pxW = 1920
      $pxH = [int][math]::Round(1920 * $h / $w)
      $slides = @()
      $jumps = @{}
      foreach ($s in $pres.Slides) {
        $n = '{0:D2}' -f $s.SlideIndex
        $texts = @()
        foreach ($sh in $s.Shapes) {
          # Operator buttons (jump to slide N, next, previous...) are hidden on the
          # image; the app offers its own verse buttons from their targets.
          $nav = NavTarget $sh
          if ($sh.Type -eq 6 -and $nav -eq $null) {
            foreach ($g in $sh.GroupItems) { $t = NavTarget $g; if ($t -ne $null) { $nav = $t; break } }
          }
          if ($nav -ne $null) {
            if ($nav -gt 0) {
              $label = ''
              if ($sh.HasTextFrame -and $sh.TextFrame.HasText) { $label = $sh.TextFrame.TextRange.Text.Trim() }
              if (-not $jumps.ContainsKey($nav) -or ($label -and -not $jumps[$nav])) { $jumps[$nav] = $label }
            }
            $sh.Visible = 0
            continue
          }
          if ($sh.HasTextFrame -and $sh.TextFrame.HasText) {
            $texts += $sh.TextFrame.TextRange.Text
          }
        }
        $s.Export("$outDir\$n.png", 'PNG', $pxW, $pxH)
        $slides += [pscustomobject]@{ n = $s.SlideIndex; hidden = [bool]($s.SlideShowTransition.Hidden); text = ($texts -join "`n") }
      }
      $jumpList = @($jumps.Keys | Sort-Object | ForEach-Object { [pscustomobject]@{ slide = $_; label = $jumps[$_] } })
      $info = [pscustomobject]@{ id = $d.id; w = $w; h = $h; slides = $slides; jumps = $jumpList }
      $info | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 "$root\work\decks\$($d.id).json"
      Write-Output "$($d.id) $($pres.Slides.Count) slides ${w}x${h}"
    } finally {
      $pres.Close()
    }
  }
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
