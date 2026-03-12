import ProductsExplorer from "./ProductsExplorer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products - SafarHub",
  description: "Browse and purchase travel products and essentials on SafarHub.",
  alternates: {
    canonical: "https://www.safarhub.in/products",
  },
};

export default function ProductsPage() {
  return <ProductsExplorer />;
}

