param(
    [Parameter(Mandatory=$false)]
    [string]$SourceFolder
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
}
if ([string]::IsNullOrWhiteSpace($SourceFolder)) {
    $SourceFolder = $ProjectRoot
}
$FontsFolder = Join-Path $ProjectRoot "fonts"
$TempFolder = Join-Path ([System.IO.Path]::GetTempPath()) ("history-reader-fonts-" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Force -Path $FontsFolder | Out-Null
New-Item -ItemType Directory -Force -Path $TempFolder | Out-Null

try {
    Get-ChildItem -Path $SourceFolder -Filter *.zip -File -ErrorAction SilentlyContinue | ForEach-Object {
        $destination = Join-Path $TempFolder ([System.IO.Path]::GetFileNameWithoutExtension($_.Name))
        Expand-Archive -LiteralPath $_.FullName -DestinationPath $destination -Force
    }

    $searchRoots = @($SourceFolder, $TempFolder)

    function Find-FirstFile([string[]]$Names) {
        foreach ($root in $searchRoots) {
            foreach ($name in $Names) {
                $match = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -ieq $name } |
                    Select-Object -First 1
                if ($match) { return $match.FullName }
            }
        }
        return $null
    }

    $fontMap = [ordered]@{
        "PTSerif-Regular.ttf" = @("PT_Serif-Web-Regular.ttf")
        "PTSerif-Bold.ttf" = @("PT_Serif-Web-Bold.ttf")
        "PTSerif-Italic.ttf" = @("PT_Serif-Web-Italic.ttf")
        "PTSerif-BoldItalic.ttf" = @("PT_Serif-Web-BoldItalic.ttf")
        "OpenSans-Regular.ttf" = @("OpenSans.ttf")
        "OpenSans-Bold.ttf" = @("ofont.ru_Open Sans.ttf")
        "OpenSans-Italic.ttf" = @("OpenSans-Italic.ttf")
        "Oswald-Regular.ttf" = @("Oswald-Regular.ttf", "Oswald.ttf")
        "Oswald-Bold.ttf" = @("Oswald-Bold.ttf")
        "Akrobat-Regular.otf" = @("Akrobat-Regular.otf")
        "Akrobat-Bold.otf" = @("Akrobat-Bold.otf")
        "Akrobat-Black.otf" = @("Akrobat-Black.otf")
        "ST-Nizhegorodsky.otf" = @("ST-Nizhegorodsky.otf")
        "Herold-Regular.otf" = @("heroldrusbyme_normal.otf")
        "Herold-Bold.otf" = @("heroldrusbyme_bold.otf", "HRL75.ttf")
        "MinionPro-Regular.otf" = @("MinionPro-Regular.otf")
        "KozukaGothicPr6N-Regular.otf" = @("KozGoPr6N-Regular.otf")
    }

    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($targetName in $fontMap.Keys) {
        $source = Find-FirstFile $fontMap[$targetName]
        if (-not $source) {
            $missing.Add($targetName)
            continue
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $FontsFolder $targetName) -Force
        Write-Host "Installed $targetName"
    }

    if ($missing.Count -gt 0) {
        Write-Warning ("Missing fonts: " + ($missing -join ", "))
        exit 2
    }

    Write-Host "All fonts were installed into $FontsFolder"
}
finally {
    Remove-Item -LiteralPath $TempFolder -Recurse -Force -ErrorAction SilentlyContinue
}
