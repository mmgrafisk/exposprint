from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from pypdf import PdfReader, PdfWriter
import html

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public"/"resources"; OUT.mkdir(parents=True,exist_ok=True)
SOURCES=[("catalogue",Path(r"C:\Users\mmgra\Downloads\Banderas_Catalogo_ESP.pdf"))]
for p in sorted((ROOT/"work"/"source-assets"/"tech").rglob("*.pdf")): SOURCES.append(("technical",p))
for p in sorted((ROOT/"work"/"source-assets"/"assembly").rglob("*.pdf")): SOURCES.append(("assembly",p))

locales={
 "da":{"catalogue":"Produktkatalog","technical":"Teknisk datablad","assembly":"Montagevejledning","note":"Alle mål og tekniske værdier på de følgende referencesider er bevaret uændret fra producentens original.","library":"Ressourcecenter"},
 "en":{"catalogue":"Product catalogue","technical":"Technical data sheet","assembly":"Assembly guide","note":"All dimensions and technical values on the following reference pages are preserved unchanged from the supplier original.","library":"Resource centre"},
 "de":{"catalogue":"Produktkatalog","technical":"Technisches Datenblatt","assembly":"Montageanleitung","note":"Alle Maße und technischen Werte auf den folgenden Referenzseiten wurden unverändert aus dem Lieferantenoriginal übernommen.","library":"Ressourcencenter"},
}

def slug(name):
 import unicodedata,re
 value=unicodedata.normalize("NFKD",name).encode("ascii","ignore").decode().lower()
 return re.sub(r"[^a-z0-9]+","-",value).strip("-")[:72]

def cover(kind,title,locale):
 buffer=BytesIO(); c=canvas.Canvas(buffer,pagesize=A4); w,h=A4
 c.setFillColor(HexColor("#11100f")); c.rect(0,0,w,h,fill=1,stroke=0)
 c.setFillColor(HexColor("#b8734a")); c.circle(w-95,h-105,165,fill=1,stroke=0)
 c.setFillColor(HexColor("#f3eadb")); c.setFont("Helvetica-Bold",15); c.drawString(54,h-60,"EXPOSPRINT")
 c.setFont("Helvetica",10); c.drawString(54,h-88,locales[locale][kind].upper())
 c.setFont("Helvetica-Bold",30); text=c.beginText(54,h-205); text.setLeading(36)
 words=title.replace("_"," ").replace("-"," ").split(); line=""
 for word in words:
  if c.stringWidth((line+" "+word).strip(),"Helvetica-Bold",30)>470: text.textLine(line); line=word
  else: line=(line+" "+word).strip()
 if line:text.textLine(line)
 c.drawText(text)
 c.setFont("Helvetica",11); c.setFillColor(HexColor("#c8beb1")); note=locales[locale]["note"]
 t=c.beginText(54,105);t.setLeading(16)
 for chunk in [note[i:i+78] for i in range(0,len(note),78)]:t.textLine(chunk)
 c.drawText(t); c.setFillColor(HexColor("#b8734a")); c.rect(54,78,70,3,fill=1,stroke=0)
 c.showPage();c.save();buffer.seek(0);return PdfReader(buffer).pages[0]

indexes={l:[] for l in locales}
for number,(kind,source) in enumerate(SOURCES,1):
 title=source.stem.replace("Ficha-tecnica-","").replace("Ficha-Tecnica-","").replace("Instrucciones montaje ","").replace(" (1)","").replace(" (3)","")
 base="catalogue" if kind=="catalogue" else slug(title)
 original=PdfReader(str(source))
 for locale in locales:
  writer=PdfWriter();writer.add_page(cover(kind,title,locale))
  for page in original.pages:writer.add_page(page)
  filename=f"{base}-{locale}.pdf";path=OUT/filename
  with path.open("wb") as f:writer.write(f)
  indexes[locale].append((locales[locale][kind],title,filename,len(original.pages)+1))

for locale,items in indexes.items():
 cards="".join(f'<a class="card" href="{html.escape(file)}"><small>{html.escape(kind)}</small><strong>{html.escape(title)}</strong><span>{pages} sider · PDF</span></a>' for kind,title,file,pages in items)
 doc=f'''<!doctype html><html lang="{locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Exposprint · {locales[locale]['library']}</title><style>body{{margin:0;background:#f3eadb;color:#11100f;font:16px Arial}}main{{width:min(1100px,calc(100% - 32px));margin:auto;padding:64px 0}}h1{{font:64px Georgia;margin:12px 0 36px}}.eyebrow{{color:#b8734a;letter-spacing:.18em;font-weight:bold;font-size:12px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}}.card{{background:#fff;padding:22px;color:inherit;text-decoration:none;border-top:4px solid #b8734a;display:grid;gap:12px}}.card small{{text-transform:uppercase;color:#b8734a}}.card strong{{font-size:20px}}.card span{{color:#766e64;font-size:13px}}a.back{{display:inline-block;margin-bottom:30px;color:inherit}}</style><main><a class="back" href="/{locale}">← Exposprint</a><div class="eyebrow">DOWNLOADS</div><h1>{locales[locale]['library']}</h1><div class="grid">{cards}</div></main></html>'''
 (OUT/f"index-{locale}.html").write_text(doc,encoding="utf-8")
print(f"Created {len(SOURCES)*len(locales)} localized PDF files")
