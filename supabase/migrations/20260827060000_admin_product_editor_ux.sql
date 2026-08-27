-- Neutral, database-backed administration copy and complete product editing.
insert into public.required_translation_keys(namespace, key, area)
select 'admin', key, 'admin'
from (values
  ('dismiss'), ('edit'), ('cancel'), ('searchProducts'), ('allStatuses'),
  ('resultCount'), ('productDetails'), ('name'), ('slug'), ('description'),
  ('altText'), ('seoTitle'), ('seoDescription'), ('category'), ('imagePath')
) as keys(key)
on conflict(namespace, key) do update set area = excluded.area;

insert into public.translation_entries(locale, namespace, key, value, status)
values
  ('da','admin','title','Kontrolcenter','published'),
  ('da','admin','dismiss','Luk','published'),
  ('da','admin','edit','Rediger','published'),
  ('da','admin','cancel','Annuller','published'),
  ('da','admin','searchProducts',U&'S\00F8g i produkter','published'),
  ('da','admin','allStatuses','Alle statusser','published'),
  ('da','admin','resultCount','Viser {{shown}} af {{total}} produkter','published'),
  ('da','admin','productDetails','Produktdetaljer','published'),
  ('da','admin','name','Navn','published'),
  ('da','admin','slug','URL-navn','published'),
  ('da','admin','description','Beskrivelse','published'),
  ('da','admin','altText','Alternativ billedtekst','published'),
  ('da','admin','seoTitle','SEO-titel','published'),
  ('da','admin','seoDescription','SEO-beskrivelse','published'),
  ('da','admin','category','Kategori','published'),
  ('da','admin','imagePath','Billedsti','published'),

  ('en','admin','title','Control centre','published'),
  ('en','admin','dismiss','Dismiss','published'),
  ('en','admin','edit','Edit','published'),
  ('en','admin','cancel','Cancel','published'),
  ('en','admin','searchProducts','Search products','published'),
  ('en','admin','allStatuses','All statuses','published'),
  ('en','admin','resultCount','Showing {{shown}} of {{total}} products','published'),
  ('en','admin','productDetails','Product details','published'),
  ('en','admin','name','Name','published'),
  ('en','admin','slug','URL slug','published'),
  ('en','admin','description','Description','published'),
  ('en','admin','altText','Alternative image text','published'),
  ('en','admin','seoTitle','SEO title','published'),
  ('en','admin','seoDescription','SEO description','published'),
  ('en','admin','category','Category','published'),
  ('en','admin','imagePath','Image path','published'),

  ('de','admin','title','Kontrollzentrum','published'),
  ('de','admin','dismiss',U&'Schlie\00DFen','published'),
  ('de','admin','edit','Bearbeiten','published'),
  ('de','admin','cancel','Abbrechen','published'),
  ('de','admin','searchProducts','Produkte suchen','published'),
  ('de','admin','allStatuses','Alle Status','published'),
  ('de','admin','resultCount','{{shown}} von {{total}} Produkten','published'),
  ('de','admin','productDetails','Produktdetails','published'),
  ('de','admin','name','Name','published'),
  ('de','admin','slug','URL-Name','published'),
  ('de','admin','description','Beschreibung','published'),
  ('de','admin','altText','Alternativer Bildtext','published'),
  ('de','admin','seoTitle','SEO-Titel','published'),
  ('de','admin','seoDescription','SEO-Beschreibung','published'),
  ('de','admin','category','Kategorie','published'),
  ('de','admin','imagePath','Bildpfad','published')
on conflict(locale, namespace, key) do update
set value = excluded.value,
    status = excluded.status,
    updated_at = now();

grant update (
  category_slug,
  approved_image_path
) on public.products to authenticated;
