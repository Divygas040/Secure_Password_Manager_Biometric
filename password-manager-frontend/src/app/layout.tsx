import { AuthProvider } from "@/context/AuthContext";
import "../styles/globals.css";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "BioPass - Secure Password Manager",
  description: "Demo password manager with encrypted storage and email or face verification",
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
    <html lang="en">
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
