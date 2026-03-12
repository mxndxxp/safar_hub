// app/vehicle-rental/page.tsx
import VehicleRentalExplorer from "./vehiclerentalExplorer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vehicle Rental - SafarHub",
  description: "Rent cars, bikes, or hire a car with driver for your travel needs.",
  alternates: {
    canonical: "https://www.safarhub.in/vehicle-rental",
  },
};

type VehicleRentalHomePageProps = {
  searchParams?: Promise<{
    category?: string | string[];
  }>;
};

export default async function VehicleRentalHomePage({
  searchParams,
}: VehicleRentalHomePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialCategory =
    typeof resolvedParams?.category === "string" ? resolvedParams.category : undefined;

  return <VehicleRentalExplorer initialCategory={initialCategory} />;
}