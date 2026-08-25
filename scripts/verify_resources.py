from pathlib import Path
from PIL import Image,ImageDraw
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"work"/"pdf-qa";OUT.mkdir(parents=True,exist_ok=True)
thumbs=[]; failures=[]
for path in sorted((ROOT/"public"/"resources").glob("*.pdf")):
 try:
  pdf=pdfium.PdfDocument(str(path))
  for n,page in enumerate(pdf):
   image=page.render(scale=.34).to_pil().convert("RGB");image.thumbnail((210,297))
   tile=Image.new("RGB",(230,335),"white");tile.paste(image,((230-image.width)//2,6))
   ImageDraw.Draw(tile).text((8,310),f"{path.name[:25]} · p{n+1}",fill="black")
   thumbs.append(tile)
 except Exception as exc: failures.append((path.name,str(exc)))
for sheet_no,start in enumerate(range(0,len(thumbs),24),1):
 sheet=Image.new("RGB",(230*6,335*4),(220,215,205))
 for i,tile in enumerate(thumbs[start:start+24]):sheet.paste(tile,((i%6)*230,(i//6)*335))
 sheet.save(OUT/f"contact-{sheet_no:02d}.jpg",quality=88)
print({"pdfs":45,"pages":len(thumbs),"sheets":len(list(OUT.glob('contact-*.jpg'))),"failures":failures})
