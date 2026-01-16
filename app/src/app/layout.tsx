import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from "@/contexts/AuthContext";
import { RBACProvider } from "@/contexts/RBACContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import ImpersonationBanner from "@/components/admin/shared/ImpersonationBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead360 - CRM for Service Businesses",
  description: "Multi-tenant CRM/ERP platform for service businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <RBACProvider>
              <ImpersonationProvider>
                <ImpersonationBanner />
                {children}
                <Toaster position="top-right" />
              </ImpersonationProvider>
            </RBACProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
