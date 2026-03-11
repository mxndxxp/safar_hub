import VehiclerentalExplorer from "../vehiclerentalExplorer";
import { VEHICLE_RENTAL_CATEGORIES, VEHICLE_RENTAL_SLUG_TO_VALUE } from "../categories";
import { Metadata } from "next";

type VehicleRentalCategoryPageProps = {
  params: Promise<{ category: string }>;
};

const categoryBreadcrumbNames: Record<string, string> = {
  all: "Vehicle Rental",
  cars: "Cars",
  bikes: "Bikes",
  "car-with-driver": "Car with Driver",
};

export async function generateMetadata({ params }: VehicleRentalCategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  
  const categoryLabels: Record<string, string> = {
    all: "Vehicle Rental - SafarHub",
    cars: "Car Rental - SafarHub",
    bikes: "Bike Rental - SafarHub",
    "car-with-driver": "Car with Driver - SafarHub",
  };
  
  const categoryDescriptions: Record<string, string> = {
    all: "Rent vehicles for your travel needs.",
    cars: "Rent cars for your journey.",
    bikes: "Rent bikes for your adventure.",
    "car-with-driver": "Hire a car with professional driver.",
  };
  
  const title = categoryLabels[slug] || "Vehicle Rental - SafarHub";
  const description = categoryDescriptions[slug] || "Rent vehicles for your travel needs.";
  
  return {
    title,
    description,
    alternates: {
      canonical: `https://www.safarhub.in/vehicle-rental/${slug}`,
    },
  };
}

function generateBreadcrumbSchema(slug: string) {
  const categoryName = categoryBreadcrumbNames[slug] || slug;
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
      "name": "Vehicle Rental",
      "item": "https://www.safarhub.in/vehicle-rental"
    },{
      "@type": "ListItem",
      "position": 4,
      "name": categoryName,
      "item": `https://www.safarhub.in/vehicle-rental/${slug}`
    }]
  };
}

const DEFAULT_CATEGORY = VEHICLE_RENTAL_CATEGORIES[0]?.value ?? "all";

export function generateStaticParams() {
  return VEHICLE_RENTAL_CATEGORIES.map((item) => ({ category: item.slug }));
}

export default async function VehicleRentalCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = VEHICLE_RENTAL_SLUG_TO_VALUE[slug] ?? DEFAULT_CATEGORY;
  
  const breadcrumbSchema = generateBreadcrumbSchema(slug);
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <VehiclerentalExplorer key={category} initialCategory={category} />
    </>
  );
}
