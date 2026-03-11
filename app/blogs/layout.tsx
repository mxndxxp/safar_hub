import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blogs - SafarHub",
  description: "Read travel stories, tips, and insights from SafarHub's blog.",
  alternates: {
    canonical: "https://www.safarhub.in/blogs",
  },
};

export default function BlogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
