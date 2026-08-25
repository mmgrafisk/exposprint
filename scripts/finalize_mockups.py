from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json,csv,shutil

ROOT=Path(__file__).resolve().parents[1]
MASTER=ROOT/"outputs"/"product-mockups"
WEB=MASTER/"web";WEB.mkdir(exist_ok=True)
PUBLIC=ROOT/"public"/"assets"/"mockups";PUBLIC.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ROOT/"work"/"imagegen-manifest.json").read_text(encoding="utf-8-sig"))
rows=[];thumbs=[]
for item in manifest:
 idx=item["index"];src=Path(item["source"]);png=MASTER/f"{idx:02d}.png"
 with Image.open(png) as generated, Image.open(src) as source:
  image=generated.convert("RGBA"); source=source.convert("RGBA")
  # Image generation may flatten a transparency checkerboard. Restore the
  # exact product silhouette from the corresponding source alpha channel.
  source_alpha=source.getchannel("A").resize(image.size,Image.Resampling.LANCZOS)
  current_alpha=image.getchannel("A")
  image.putalpha(ImageChops.multiply(current_alpha,source_alpha))
  image.save(png,"PNG",optimize=True)
  has_alpha=image.getchannel("A").getextrema()[0]<255
  web=image.copy();web.thumbnail((1400,1400),Image.Resampling.LANCZOS)
  web.save(WEB/f"{idx:02d}.webp","WEBP",quality=86,method=6)
  shutil.copy2(WEB/f"{idx:02d}.webp",PUBLIC/f"{idx:02d}.webp")
  avif_ok=True
  try:web.save(WEB/f"{idx:02d}.avif","AVIF",quality=72)
  except Exception:avif_ok=False
  preview=Image.new("RGBA",image.size,(243,234,219,255));preview.alpha_composite(image.convert("RGBA"));preview=preview.convert("RGB");preview.thumbnail((180,180))
  tile=Image.new("RGB",(200,225),"white");tile.paste(preview,((200-preview.width)//2,4));ImageDraw.Draw(tile).text((8,192),f"{idx:02d} · {src.stem[:22]}",fill="black");thumbs.append(tile)
 rows.append({"index":f"{idx:02d}","source":str(src),"master_png":str(png),"webp":str(WEB/f'{idx:02d}.webp'),"avif":str(WEB/f'{idx:02d}.avif') if avif_ok else "unsupported","transparent":has_alpha,"alt_da":f"Exposprint {src.stem} med sort, kobber og creme tryk","alt_en":f"Exposprint {src.stem} with black, copper and cream print","alt_de":f"Exposprint {src.stem} mit schwarzem, kupferfarbenem und cremefarbenem Druck"})
with (MASTER/"manifest.csv").open("w",newline="",encoding="utf-8-sig") as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
for page,start in enumerate(range(0,len(thumbs),20),1):
 sheet=Image.new("RGB",(1000,900),(225,218,207))
 for i,t in enumerate(thumbs[start:start+20]):sheet.paste(t,((i%5)*200,(i//5)*225))
 sheet.save(MASTER/f"contact-{page}.jpg",quality=90)
print({"masters":len(rows),"transparent":sum(r['transparent'] for r in rows),"avif":sum(r['avif']!='unsupported' for r in rows)})
