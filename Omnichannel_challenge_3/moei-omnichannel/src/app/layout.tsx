import type { Metadata } from "next";
import { Roboto, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import RTLSync from "@/components/rtl-sync";
import { SuppressWarnings } from "@/components/suppress-warnings";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-noto-kufi-arabic",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MOEI - Omnichannel AI Customer Engagement",
  description: "UAE Ministry of Energy & Infrastructure - Intelligent Customer Engagement Platform",
  keywords: ["MOEI", "UAE", "Customer Engagement", "AI", "Omnichannel"],
  authors: [{ name: "MOEI" }],
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${roboto.variable} ${notoKufiArabic.variable} antialiased bg-background text-foreground`} 
        suppressHydrationWarning
        style={{ fontFamily: 'var(--font-roboto), var(--font-noto-kufi-arabic), sans-serif' }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SuppressWarnings />
          <RTLSync />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
