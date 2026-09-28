Add-Type -AssemblyName System.Drawing

$root = 'C:\Users\USUARIO\OneDrive\Desktop\jmp\docs'
$exts = @('.jpg', '.jpeg', '.png', '.jfif')
$changed = 0

Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $exts -contains $_.Extension.ToLower() } |
    ForEach-Object {
        $path = $_.FullName
        try {
            $img = [System.Drawing.Image]::FromFile($path)
            $property = $img.PropertyItems | Where-Object { $_.Id -eq 274 } | Select-Object -First 1

            if ($null -eq $property) {
                $img.Dispose()
                return
            }

            $orientation = [System.BitConverter]::ToUInt16($property.Value, 0)
            if ($orientation -eq 0 -or $orientation -eq 1) {
                $img.Dispose()
                return
            }

            $rotateFlip = switch ($orientation) {
                2 { [System.Drawing.RotateFlipType]::RotateNoneFlipX }
                3 { [System.Drawing.RotateFlipType]::Rotate180FlipNone }
                4 { [System.Drawing.RotateFlipType]::Rotate180FlipX }
                5 { [System.Drawing.RotateFlipType]::Rotate90FlipX }
                6 { [System.Drawing.RotateFlipType]::Rotate90FlipNone }
                7 { [System.Drawing.RotateFlipType]::Rotate270FlipX }
                8 { [System.Drawing.RotateFlipType]::Rotate270FlipNone }
                default { $null }
            }

            if ($null -ne $rotateFlip) {
                $img.RotateFlip($rotateFlip)
                try { $img.RemovePropertyItem(274) } catch {}
                $img.Save($path, $img.RawFormat)
                $changed++
                Write-Host "Corrigido: $path (orientacao: $orientation)"
            }

            $img.Dispose()
        }
        catch {
            Write-Host "Erro: $path => $($_.Exception.Message)"
        }
    }

Write-Host "Total corrigido: $changed"
