# Ask Microsoft Word which list number it shows for every paragraph.
# Used only by the optional oracle test (TZ_WORD_ORACLE=1) to prove that
# our numbering replay matches Word. Documents are opened read-only.
param(
    [Parameter(Mandatory = $true)][string]$ListFile,
    [Parameter(Mandatory = $true)][string]$OutFile
)

$ErrorActionPreference = 'Stop'
$paths = Get-Content -LiteralPath $ListFile -Encoding UTF8 | Where-Object { $_ }
$result = @{}
$word = New-Object -ComObject Word.Application
try {
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3   # never run macros
    foreach ($path in $paths) {
        $doc = $word.Documents.Open($path, $false, $true, $false)
        try {
            $items = New-Object System.Collections.ArrayList
            foreach ($paragraph in $doc.Paragraphs) {
                $range = $paragraph.Range
                [void]$items.Add(@{
                    list = [string]$range.ListFormat.ListString
                    text = [string]$range.Text
                    page = [int]$range.Information(3)
                })
            }
            $result[$path] = $items
        }
        finally {
            $doc.Close($false)
        }
    }
}
finally {
    # this Word instance was started by the script: close it without saving
    $word.Quit([ref]0)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
$json = $result | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($OutFile, $json, (New-Object System.Text.UTF8Encoding $false))
