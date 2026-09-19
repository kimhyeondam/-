// 단가표 규칙: 매출 단가 = 품목 기준 단가 × 거래처 적용률(%) / 100
import type { Customer, Product } from "@/data/sample";
import { matchProduct } from "@/lib/inventory/stock";

export function rateOf(customer?: Customer) {
  const r = customer?.priceRate;
  return r === undefined || r === null || Number.isNaN(r) ? 100 : r;
}

/** 거래처 이름과 품명·규격으로 단가를 구합니다. 기준 단가가 없으면 undefined */
export function priceFor(products: Product[], customers: Customer[], customerName: string | undefined, itemName: string, spec?: string): { price: number; product: Product; rate: number } | undefined {
  const product = matchProduct(products, itemName, spec);
  if (!product || !product.basePrice) return undefined;
  const customer = customerName ? customers.find((c) => c.name === customerName.trim()) : undefined;
  const rate = rateOf(customer);
  return { price: Math.round((product.basePrice * rate) / 100), product, rate };
}
