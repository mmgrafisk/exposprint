from pathlib import Path
from PIL import Image, ImageEnhance
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work" / "source-assets" / "images"
OUT = ROOT / "public" / "assets" / "products"
OUT.mkdir(parents=True, exist_ok=True)

def find(fragment: str) -> Path:
    matches = [p for p in SOURCE.rglob("*") if p.is_file() and fragment.lower() in p.name.lower()]
    if not matches:
        raise FileNotFoundError(fragment)
    return matches[0]

mapping = {
    "tent-3x3.png": find("Carpa-3x3m.png"),
    "photocall.png": find("Photocall.png"),
    "banner.png": find("pancarta con velcro.png"),
    "tablecloth.png": find("White-Tablecloth.png"),
    "flag.png": find("Bandera-de-pared.png"),
}

generated = Path(r"C:\Users\mmgra\.codex\generated_images\01a0392d-289b-7f42-ae5d-f9aa5b16d670\exec-2fee3db3-25c0-4f86-a9db-e38705663590.png")
mapping["fly-banner-drop.png"] = generated if generated.exists() else find("Fly Banner Gota en Base De Luxe.png")

for name, source in mapping.items():
    with Image.open(source) as image:
        image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA")
        image.save(OUT / name, "PNG", optimize=True)
        rgb = Image.new("RGB", image.size, (243, 234, 219))
        if image.mode == "RGBA":
            rgb.paste(image, mask=image.getchannel("A"))
        else:
            rgb.paste(image)
        rgb.save(OUT / name.replace(".png", ".webp"), "WEBP", quality=84, method=6)

# Accessories remain photographic: crop whitespace, lightly correct and web-optimize.
accessories = [p for p in SOURCE.rglob("*.jpg")]
acc_out = OUT / "accessories"
acc_out.mkdir(exist_ok=True)
for index, source in enumerate(accessories, 1):
    with Image.open(source).convert("RGB") as image:
        image = ImageEnhance.Contrast(image).enhance(1.04)
        image.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
        image.save(acc_out / f"accessory-{index:02d}.webp", "WEBP", quality=82, method=6)

print(f"Prepared {len(mapping)} storefront images and {len(accessories)} accessories")
