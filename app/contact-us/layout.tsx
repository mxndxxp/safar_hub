import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us - SafarHub",
  description: "Get in touch with SafarHub for any inquiries or support. We're here to help with your travel needs.",
  alternates: {
    canonical: "https://www.safarhub.in/contact-us",
  },
};

export default function ContactUsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
