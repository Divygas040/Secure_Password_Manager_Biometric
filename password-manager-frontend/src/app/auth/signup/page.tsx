"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { 
  generateStrongPassword, 
  evaluatePasswordStrength, 
  getPasswordStrengthLabel, 
  getPasswordStrengthColor 
} from "@/utils/passwordGenerator";

export default function SignupPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordOptions, setPasswordOptions] = useState({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  });
  const [showPasswordOptions, setShowPasswordOptions] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Add useEffect to update password strength when password changes
  useEffect(() => {
    setPasswordStrength(evaluatePasswordStrength(password));
  }, [password]);

  // Form validation
  const validateForm = () => {
    if (!name || name.length < 3) {
      toast.error("Name must be at least 3 characters");
      return false;
    }
    if (!phone || !/^\d{10,12}$/.test(phone)) {
      toast.error("Please enter a valid phone number");
      return false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }
    return true;
  };

  // Handle Signup API Call
  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    // Prepare the request data
    const requestData = {
      username: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      password: password,
    };

    // Log the request data for debugging
    console.log("Sending signup request with data:", requestData);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/users/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      // Log the response status
      console.log("Signup response status:", response.status);

      const data = await response.json();
      
      // Log the response data
      console.log("Signup response data:", data);

      if (response.ok) {
        toast.success("Account created successfully!");
        setTimeout(() => router.push("../auth/login"), 1500);
      } else {
        // Display more detailed error message
        const errorMessage = data.error || Object.values(data).flat().join(', ') || "Signup failed. Please try again.";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("⚠️ API Error:", error);
      toast.error("Error connecting to the server");
    } finally {
      setLoading(false);
    }
  };

  // Function to generate password
  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword(passwordOptions);
    setPassword(newPassword);
    setShowPassword(true); // Show the generated password
    toast.success("Strong password generated!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white px-4">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-20 right-40 w-80 h-80 bg-green-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-40 left-20 w-80 h-80 bg-blue-500 rounded-full filter blur-3xl"></div>
      </div>

      {/* Signup Card */}
      <div className={`glass-card p-8 w-full max-w-md ${mounted ? 'animate-fadeIn' : ''}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-1">Create Account</h2>
          <p className="text-gray-400">Join the secure password management revolution</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className={`space-y-5 ${mounted ? 'animate-slideUp' : ''}`}>
        {/* Name Input */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
            <div className="relative">
              <div className="icon-container-left">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
        <input
                id="name"
          type="text"
                placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
                className="input-modern input-icon-left"
          required
        />
            </div>
          </div>

        {/* Phone Input */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
            <div className="relative">
              <div className="icon-container-left">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
        <input
                id="phone"
          type="tel"
                placeholder="1234567890"
          value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="input-modern input-icon-left"
          required
        />
            </div>
          </div>

        {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
            <div className="relative">
              <div className="icon-container-left">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
        <input
                id="email"
          type="email"
                placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
                className="input-modern input-icon-left"
          required
        />
            </div>
          </div>

        {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <div className="relative">
              <div className="icon-container-left">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
        <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
                className="input-modern input-icon-left input-icon-right"
          required
        />
              <div 
                className="icon-container-right flex space-x-2"
              >
                {/* Generate password button */}
                <button
                  type="button"
                  onClick={() => setShowPasswordOptions(!showPasswordOptions)}
                  className="px-1 focus:outline-none"
                  title="Generate Password"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
                
                {/* Show/hide password button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-1 focus:outline-none"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password strength indicator */}
            {password && (
              <div className="mt-2">
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${
                      passwordStrength >= 80 ? 'bg-green-500' : 
                      passwordStrength >= 60 ? 'bg-blue-500' : 
                      passwordStrength >= 40 ? 'bg-yellow-500' : 
                      passwordStrength >= 20 ? 'bg-orange-500' : 'bg-red-500'
                    }`} 
                    style={{ width: `${passwordStrength}%` }}
                  ></div>
                </div>
                <p className={`text-xs mt-1 ${getPasswordStrengthColor(passwordStrength)}`}>
                  Password Strength: {getPasswordStrengthLabel(passwordStrength)}
                </p>
              </div>
            )}
            
            {/* Password generation options */}
            {showPasswordOptions && (
              <div className="mt-3 p-3 bg-gray-800 border border-gray-700 rounded-lg animate-fadeIn">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-300">Password Generator</h3>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                  >
                    Generate
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="flex justify-between text-xs text-gray-400">
                      <span>Length: {passwordOptions.length}</span>
                    </label>
                    <input
                      type="range"
                      min="8"
                      max="32"
                      value={passwordOptions.length}
                      onChange={(e) => setPasswordOptions({...passwordOptions, length: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center space-x-2 text-gray-400">
                      <input
                        type="checkbox"
                        checked={passwordOptions.includeUppercase}
                        onChange={() => setPasswordOptions({...passwordOptions, includeUppercase: !passwordOptions.includeUppercase})}
                        className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800"
                      />
                      <span>Uppercase (A-Z)</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 text-gray-400">
                      <input
                        type="checkbox"
                        checked={passwordOptions.includeLowercase}
                        onChange={() => setPasswordOptions({...passwordOptions, includeLowercase: !passwordOptions.includeLowercase})}
                        className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800"
                      />
                      <span>Lowercase (a-z)</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 text-gray-400">
                      <input
                        type="checkbox"
                        checked={passwordOptions.includeNumbers}
                        onChange={() => setPasswordOptions({...passwordOptions, includeNumbers: !passwordOptions.includeNumbers})}
                        className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800"
                      />
                      <span>Numbers (0-9)</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 text-gray-400">
                      <input
                        type="checkbox"
                        checked={passwordOptions.includeSymbols}
                        onChange={() => setPasswordOptions({...passwordOptions, includeSymbols: !passwordOptions.includeSymbols})}
                        className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800"
                      />
                      <span>Symbols (!@#$...)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
          </div>

          {/* Terms & Conditions */}
          <div className="flex items-center">
            <input
              id="terms"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800"
              required
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-gray-400">
              I agree to the <span className="text-blue-500 cursor-pointer hover:underline">Terms of Service</span> and <span className="text-blue-500 cursor-pointer hover:underline">Privacy Policy</span>
            </label>
          </div>

          {/* Submit Button */}
        <button
            type="submit"
            className="btn-modern btn-primary w-full flex items-center justify-center mt-6"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
        </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p
            className="text-sm text-gray-400 cursor-pointer hover:text-blue-500 transition duration-300"
            onClick={() => router.push("/auth/login")}
          >
            Already have an account? <span className="font-medium">Log in</span>
          </p>
        </div>
      </div>
    </div>
  );
}
