import AdventuresExplorer from "../AdventuresExplorer";
import { ADVENTURE_CATEGORIES } from "../categories";
import type { AdventureCategoryValue } from "../categories";
import { notFound } from "next/navigation";
import { Metadata } from "next";

type CategoryPageProps = {
  params: Promise<{
    category: AdventureCategoryValue;
  }>;
};

const VALID_CATEGORIES = ADVENTURE_CATEGORIES.map(
  (cat) => cat.value
);

const categoryBreadcrumbNames: Record<string, string> = {
  all: "Adventures",
  trekking: "Trekking",
  hiking: "Hiking",
  camping: "Camping",
  "water-rafting": "Water Rafting",
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  
  const categoryLabels: Record<string, string> = {
    all: "Adventures - SafarHub",
    trekking: "Trekking - SafarHub",
    hiking: "Hiking - SafarHub",
    camping: "Camping - SafarHub",
    "water-rafting": "Water Rafting - SafarHub",
  };
  
  const categoryDescriptions: Record<string, string> = {
    all: "Experience thrilling adventures.",
    trekking: "Explore amazing trekking routes.",
    hiking: "Discover scenic hiking trails.",
    camping: "Enjoy memorable camping experiences.",
    "water-rafting": "Feel the adrenaline with water rafting.",
  };
  
  const title = categoryLabels[category] || "Adventures - SafarHub";
  const description = categoryDescriptions[category] || "Experience thrilling adventures.";
  
  return {
    title,
    description,
    alternates: {
      canonical: `https://www.safarhub.in/adventures/${category}`,
    },
  };
}

function generateBreadcrumbSchema(category: string) {
  const categoryName = categoryBreadcrumbNames[category] || category;
  return {
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
    },{
      "@type": "ListItem",
      "position": 3,
      "name": "Adventures",
      "item": "https://www.safarhub.in/adventures"
    },{
      "@type": "ListItem",
      "position": 4,
      "name": categoryName,
      "item": `https://www.safarhub.in/adventures/${category}`
    }]
  };
}

export async function generateStaticParams() {
  return ADVENTURE_CATEGORIES.map((cat) => ({
    category: cat.value,
  }));
}

export default async function AdventureCategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  // If it looks like a MongoDB ID (24 hex chars), this route shouldn't match
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(category);
  
  // ❌ If category is invalid → 404
  if (isMongoId || !VALID_CATEGORIES.includes(category)) {
    notFound();
  }

  const breadcrumbSchema = generateBreadcrumbSchema(category);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <AdventuresExplorer initialCategory={category} />
    </>
  );
}
