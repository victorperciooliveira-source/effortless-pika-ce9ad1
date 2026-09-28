from pathlib import Path
from PIL import Image, ImageOps

root = Path(r'C:\Users\USUARIO\OneDrive\Desktop\jmp\docs')
exts = {'.jpg', '.jpeg', '.png', '.jfif'}
fixed = 0
total = 0

for path in sorted(root.rglob('*')):
    if path.suffix.lower() not in exts:
        continue
    total += 1
    try:
        with Image.open(path) as img:
            rotated = ImageOps.exif_transpose(img)
            if rotated.size != img.size:
                rotated.save(path)
                fixed += 1
                print(f'CORRIGIDO {path}')
    except Exception as exc:
        print(f'ERRO {path}: {exc}')

print(f'TOTAL_IMAGENS={total} TOTAL_CORRIGIDAS={fixed}')
