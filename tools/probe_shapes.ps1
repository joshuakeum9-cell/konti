# Debug helper: list every shape on every slide of one deck with its type, text and click action.
# Usage: powershell -File tools/probe_shapes.ps1 "<file name in source/>"
param([string]$File)
$root = (Get-Location).Path
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open("$root\source\$File", -1, 0, 0)
foreach ($s in $pres.Slides) {
  foreach ($sh in $s.Shapes) {
    $a = $sh.ActionSettings.Item(1)
    $t = ''
    if ($sh.HasTextFrame -and $sh.TextFrame.HasText) { $t = $sh.TextFrame.TextRange.Text }
    $link = ''
    if ($a.Action -eq 7) { $link = "sub=$($a.Hyperlink.SubAddress) addr=$($a.Hyperlink.Address)" }
    "{0} | {1} type={2} vis={3} act={4} {5} | {6},{7} {8}x{9} | {10}" -f $s.SlideIndex, $sh.Name, $sh.Type, $sh.Visible, $a.Action, $link, [int]$sh.Left, [int]$sh.Top, [int]$sh.Width, [int]$sh.Height, $t
  }
}
$pres.Close(); $app.Quit()
