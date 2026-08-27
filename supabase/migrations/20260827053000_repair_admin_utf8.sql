update public.translation_entries
set value = convert_from(convert_to(value, 'WIN1252'), 'UTF8'),
    updated_at = now()
where namespace = 'admin'
  and (
    (locale = 'da' and key in (
      'add', 'addCurrency', 'addLocale', 'loading', 'payment_expired', 'price',
      'saved', 'saveError', 'shippingPrice', 'translationCoverage', 'translations'
    ))
    or
    (locale = 'de' and key in (
      'add', 'addCurrency', 'addLocale', 'artwork_review', 'currency',
      'currencyCode', 'currencyName', 'currencySymbol', 'loading', 'overview',
      'published', 'saved', 'saveError', 'translationCoverage', 'translations'
    ))
    or
    (locale = 'en' and key = 'loading')
  )
  and (
    strpos(value, chr(195)) > 0
    or strpos(value, chr(194)) > 0
    or strpos(value, chr(226)) > 0
  );
