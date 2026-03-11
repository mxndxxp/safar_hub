import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services - SafarHub",
  description: "Explore our wide range of travel services including stays, tours, adventures, and vehicle rentals.",
  alternates: {
    canonical: "https://www.safarhub.in/services",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org/",
  "@type": "BreadcrumbList",
  "itemListElement": [{
    "@type": "ListItem",
    "position": 1,
    "name": "Safar Hub",
    "item": "https://www.safarhub.in/"
  },{
    "@type": "ListItem",
    "position": 2,
    "name": "Services",
    "item": "https://www.safarhub.in/services"
  }]
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
