import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/supabase/server";

const aliases = {
  sku: ["sku", "referencia", "reference"],
  name: ["name", "nombre", "product"],
  cost: ["cost", "supplier price", "net price", "precio neto"],
  production: ["production days", "lead time", "produccion"],
};
function findKey(row: Record<string, unknown>, names: string[]) {
  return Object.keys(row).find((key) => names.includes(key.trim().toLowerCase()));
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "CSV_OR_XLSX_REQUIRED" }, { status: 400 });
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "" });
  const preview = rows.slice(0, 250).map((row, index) => {
    const sku = String(row[findKey(row, aliases.sku) ?? ""] ?? "").trim();
    const cost = Number(row[findKey(row, aliases.cost) ?? ""]);
    const productionDays = Number(row[findKey(row, aliases.production) ?? ""]);
    const errors: string[] = [];
    if (!sku) errors.push("MISSING_SKU");
    if (!(cost > 0)) errors.push("INVALID_SUPPLIER_PRICE");
    if (!(productionDays > 0)) errors.push("DELIVERY_APPROVAL_REQUIRED");
    return {
      row: index + 2,
      sku,
      name: row[findKey(row, aliases.name) ?? ""],
      supplierCostMinor: cost > 0 ? Math.round(cost * 100) : null,
      netSaleMinor: cost > 0 ? Math.round((cost * 100) / 0.60) : null,
      productionDays: productionDays > 0 ? productionDays : null,
      errors,
      publication: errors.length ? "draft" : "pending-image-review",
    };
  });
  return NextResponse.json({ sourceRows: rows.length, preview, valid: preview.filter((row) => !row.errors.length).length, invalid: preview.filter((row) => row.errors.length).length, idempotency: "upsert-by-sku" });
}
