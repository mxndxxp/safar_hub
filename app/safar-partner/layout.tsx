import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Safar Partner - SafarHub",
  description: "Become a SafarHub partner and list your stays, tours, adventures, or vehicle rentals.",
  alternates: {
    canonical: "https://www.safarhub.in/safar-partner",
  },
};

export default function SafarPartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
