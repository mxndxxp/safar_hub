import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us - SafarHub",
  description: "Learn more about SafarHub and our mission to provide the best travel experiences.",
  alternates: {
    canonical: "https://www.safarhub.in/about-us",
  },
};

export default function AboutUsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
