"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AuthPage() {
  const { setIsAuthenticated } = useAuth();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true); // Toggle between login/signup

  const handleAuth = () => {
    setIsAuthenticated(true);
    toast.success(isLogin ? "Logged in successfully!" : "Account created!");
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-2xl font-bold">{isLogin ? "Login" : "Sign Up"}</h2>

      <input
        type="text"
        placeholder="Email"
        className="mt-4 p-2 border rounded w-80 text-black"
      />
      <input
        type="password"
        placeholder="Password"
        className="mt-4 p-2 border rounded w-80 text-black"
      />

      <button
        className="mt-4 px-6 py-2 bg-blue-600 rounded-lg"
        onClick={handleAuth}
      >
        {isLogin ? "Login" : "Sign Up"}
      </button>

      <p
        className="mt-4 text-sm cursor-pointer"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin
          ? "Don't have an account? Sign up"
          : "Already have an account? Login"}
      </p>
    </div>
  );
}
