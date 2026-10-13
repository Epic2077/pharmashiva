import { notFound } from "next/navigation";
import SinglePage from "@/components/products/SinglePage";
import { getProductById } from "@/lib/supabase";
import { getServerLanguage } from "@/lib/i18n-server";
import type { ProductDetails } from "@/types/database";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const language = await getServerLanguage();

  let product: ProductDetails | null = null;
  try {
    product = await getProductById(id);
  } catch (error) {
    console.error("Supabase query failed:", error);
  }

  if (!product) notFound();

  return <SinglePage product={product} language={language} />;
}
