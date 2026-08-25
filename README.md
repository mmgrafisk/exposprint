# Exposprint Europe

A multilingual storefront concept for European exhibition equipment. The interface includes a responsive product catalogue, persistent-feeling cart interactions, Danish/English/German content, account login and an administration dashboard.

## Local development

```bash
npm install
npm run dev
```

Use `admin@exposprint.eu` / `demo123` to preview the administration area.

> The checkout button is a front-end integration point. Connect a PCI-compliant payment provider (such as Stripe) and an authenticated backend before processing real orders. Supplier fulfilment should likewise be connected through Adivin's approved partner integration rather than exposing supplier credentials in the browser.
