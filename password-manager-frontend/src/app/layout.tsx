import { AuthProvider } from "@/context/AuthContext";
import "../styles/globals.css";
import { Toaster } from "react-hot-toast";
import { Inter } from "next/font/google";

// Load Inter font
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "BioPass - Secure Password Manager",
  description: "Modern password management with advanced biometric security",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#111827" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <div className="fixed inset-0 bg-gradient-radial from-gray-900 to-black -z-10"></div>
        <AuthProvider>
          {children}
          <Toaster 
            position="top-right" 
            toastOptions={{
              duration: 3000,
              style: {
                background: "#1F2937",
                color: "#F9FAFB",
                border: "1px solid rgba(59, 130, 246, 0.2)",
              },
              success: {
                iconTheme: {
                  primary: "#10B981",
                  secondary: "white",
                },
              },
              error: {
                iconTheme: {
                  primary: "#EF4444",
                  secondary: "white",
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
