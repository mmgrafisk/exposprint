# ExposPrint design-QA

Dato: 25. august 2026

## Visuel retning

- ExposPrints godkendte produktbilleder er den konkrete visuelle reference.
- Figma-kittet “Ultimate Landing Page Wireframe Kit” er brugt som strukturel reference for informationshierarki og sektionering; det erstatter ikke ExposPrints premiumidentitet.
- Farver: mørk grafit, kobber og creme. Ingen gradients eller tegnede placeholder-assets.

## Kontrolleret i browser

- Desktop 1440 × 1000: header, hero, produktbillede, CTA’er og leveringsland står rent uden overlap.
- Mobil 390 × 844: navigation, hero og produktvisual skalerer korrekt. Målt `scrollWidth` er lig `clientWidth`; ingen vandret overflow.
- Produkt: produktgalleri, meningsfulde valgmuligheder, antal, artwork, produktion, levering, gratis fragt og momsinkluderet pris.
- Kurv: produktkonfiguration, fri fragt som eksplicit linje, samlet levering, handelsbetingelser og “Køb med betalingspligt”.
- Sprog, valuta og leveringsland kommer fra databasen og kan skiftes uafhængigt.

## Resultat

Godkendt til lokal funktionel vurdering. Publicering er fortsat blokeret af de bevidste juridiske og virksomhedsrelaterede lanceringskrav.
