"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white px-4 py-12">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-green-500 rounded-full filter blur-3xl"></div>
      </div>

      {/* Logo and Header */}
      <div className={`mb-8 text-center animate-${mounted ? 'fadeIn' : ''}`}>
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg">
              <span className="text-4xl">🔐</span>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                <span className="animate-pulse">✓</span>
              </div>
            </div>
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">
          BioPass
        </h1>
        <p className="text-gray-400 max-w-md mx-auto">
          Welcome,Your Face is Your Identity
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-12">
        {[
          { title: "Face Recognition", icon: "👤", desc: "Unlock with your face" },
          { title: "OTP Authentication", icon: "🔢", desc: "Extra layer of security" },
          { title: "Secure Storage", icon: "🔒", desc: "Military-grade encryption" }
        ].map((feature, index) => (
          <div 
            key={index} 
            className={`glass-card p-6 ${mounted ? 'animate-slideUp' : ''}`} 
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="text-4xl mb-4">{feature.icon}</div>
            <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
            <p className="text-gray-400">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className={`space-y-4 w-full max-w-md ${mounted ? 'animate-slideUp' : ''}`} style={{ animationDelay: "0.3s" }}>
        {/* Login Button */}
        <button
          className="btn-modern btn-primary w-full flex items-center justify-center gap-2"
          onClick={() => router.push("/auth/login")}
        >
          <span>Login to Your Account</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Sign Up Button */}
        <button
          className="btn-modern btn-outline w-full"
          onClick={() => router.push("/auth/signup")}
        >
          Create New Account
        </button>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} BioPass. All rights reserved.</p>
        <p className="mt-1">Advanced security for modern digital life.</p>
      </div>
    </div>
  );
}