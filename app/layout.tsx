import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pastelaria Recanto | Pastel de verdade",
  description: "Pastéis crocantes, recheados e feitos na hora. Peça para entrega ou retirada.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
