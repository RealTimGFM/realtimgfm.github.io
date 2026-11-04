# Local authoring utility; no runtime dependency. Run from the repository root on Windows.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path -Parent $PSScriptRoot
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile((Join-Path $repoRoot 'assets/fonts/roboto.ttf'))
$bitmap = New-Object System.Drawing.Bitmap 1200, 630
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$navy = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#08163f'))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#365785'))
$coral = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#ff7665'))
$rule = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#b5d4ed')), 2
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#e5f4ff'))
$family = $fonts.Families[0]
$nameFont = New-Object System.Drawing.Font $family, 106, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$roleFont = New-Object System.Drawing.Font $family, 48, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$bodyFont = New-Object System.Drawing.Font $family, 28, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$smallFont = New-Object System.Drawing.Font $family, 23, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$graphics.FillRectangle($coral, 80, 94, 56, 6)
$graphics.DrawString('Tim Vu', $nameFont, $navy, 72, 139)
$graphics.DrawString('Backend Developer', $roleFont, $navy, 78, 280)
$graphics.DrawString('C# / ASP.NET / SQL Server / REST APIs', $bodyFont, $muted, 80, 367)
$graphics.DrawLine($rule, 80, 490, 1120, 490)
$graphics.DrawString('realtimgfm.github.io', $smallFont, $muted, 80, 525)
$bitmap.Save((Join-Path $repoRoot 'assets/social-preview.png'), [System.Drawing.Imaging.ImageFormat]::Png)
foreach ($resource in @($nameFont, $roleFont, $bodyFont, $smallFont, $rule, $navy, $muted, $coral, $graphics, $bitmap, $fonts)) { $resource.Dispose() }
