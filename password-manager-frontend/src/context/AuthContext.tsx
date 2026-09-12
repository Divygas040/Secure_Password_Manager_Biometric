"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  isFaceVerified: boolean;
  setIsFaceVerified: (verified: boolean) => void;
  isOTPVerified: boolean;
  setIsOTPVerified: (verified: boolean) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (authenticated: boolean) => void; // Add this line
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isFaceVerified, setIsFaceVerified] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <AuthContext.Provider
      value={{
        isFaceVerified,
        setIsFaceVerified,
        isOTPVerified,
        setIsOTPVerified,
        isAuthenticated,
        setIsAuthenticated, // Add this line
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
