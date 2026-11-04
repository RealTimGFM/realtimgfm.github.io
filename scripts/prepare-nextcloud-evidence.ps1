param(
    [Parameter(Mandatory=$true)][string]$FilesImage,
    [Parameter(Mandatory=$true)][string]$DockerImage
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '../assets/homelab'

function Save-SanitizedCapture {
    param([string]$Source, [string]$Name, [int]$Width, [int]$Height,
        [System.Drawing.Rectangle]$Crop, [object[]]$Masks)
    $original = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source).Path)
    try {
        if ($original.Width -ne $Width -or $original.Height -ne $Height) {
            throw "Unexpected dimensions for $Name. Inspect the new source and update the redaction coordinates first."
        }
        # Draw onto a fresh opaque bitmap: original pixels and metadata are never copied to disk.
        $sanitized = New-Object System.Drawing.Bitmap($Crop.Width, $Crop.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb))
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($sanitized)
            try {
                $graphics.DrawImage($original, ([System.Drawing.Rectangle]::new(0, 0, $Crop.Width, $Crop.Height)), $Crop, [System.Drawing.GraphicsUnit]::Pixel)
                foreach ($mask in $Masks) {
                    $graphics.FillRectangle([System.Drawing.Brushes]::Black, [int]$mask[0], [int]$mask[1], [int]$mask[2], [int]$mask[3])
                }
            } finally { $graphics.Dispose() }
            # Verify every redacted pixel before creating either shipping rendition.
            foreach ($mask in $Masks) {
                for ($y = $mask[1]; $y -lt ($mask[1] + $mask[3]); $y++) {
                    for ($x = $mask[0]; $x -lt ($mask[0] + $mask[2]); $x++) {
                        if ($sanitized.GetPixel($x, $y).ToArgb() -ne [System.Drawing.Color]::Black.ToArgb()) {
                            throw "Non-opaque redaction in $Name."
                        }
                    }
                }
            }
            $sanitized.Save((Join-Path $assetDirectory "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
            $thumbHeight = [int][Math]::Round($Crop.Height * 960.0 / $Crop.Width)
            $thumbnail = New-Object System.Drawing.Bitmap(960, $thumbHeight, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb))
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($thumbnail)
                try {
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $graphics.DrawImage($sanitized, 0, 0, 960, $thumbHeight)
                } finally { $graphics.Dispose() }
                $thumbnail.Save((Join-Path $assetDirectory "$Name-960.png"), [System.Drawing.Imaging.ImageFormat]::Png)
            } finally { $thumbnail.Dispose() }
        } finally { $sanitized.Dispose() }
    } finally { $original.Dispose() }
}

# Nextcloud: suggested folder name plus both personal folder labels; retain genuine controls.
Save-SanitizedCapture -Source $FilesImage -Name 'nextcloud-files' -Width 1874 -Height 970 -Crop ([System.Drawing.Rectangle]::new(0, 0, 1874, 970)) -Masks @(
    @(397, 131, 90, 23), @(554, 432, 88, 25), @(776, 432, 88, 25)
)
# Terminal: crop title bar and final prompt/empty space. Coordinates are relative to that crop.
# Masks remove three shell identities, the sudo identity, the Compose path, and the ID column.
Save-SanitizedCapture -Source $DockerImage -Name 'nextcloud-docker' -Width 1919 -Height 662 -Crop ([System.Drawing.Rectangle]::new(0, 32, 1919, 474)) -Masks @(
    @(0, 7, 154, 28), @(0, 35, 390, 30), @(0, 211, 154, 29),
    @(0, 299, 154, 29), @(603, 268, 510, 29), @(0, 326, 213, 148)
)
Write-Output 'Prepared opaque-redacted full-size PNGs and 960px thumbnails.'
