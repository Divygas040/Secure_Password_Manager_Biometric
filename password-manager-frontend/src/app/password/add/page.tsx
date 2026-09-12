"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { 
  generateStrongPassword, 
  evaluatePasswordStrength, 
  getPasswordStrengthLabel, 
  getPasswordStrengthColor 
} from "@/utils/passwordGenerator";

const AddPasswordForm = () => {
  const router = useRouter();

  const [domainName, setDomainName] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
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
    setPasswordStrength(evaluatePasswordStrength(password));
  }, [password]);

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword(passwordOptions);
    setPassword(newPassword);
    setShowPassword(true);
    toast.success("Strong password generated!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("You must be logged in to add a password.");
      setLoading(false);
      return;
    }

    const response = await fetch(
      "http://127.0.0.1:8000/api/users/add_password/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain_name: domainName,
          password: password,
          link: link,
        }),
      }
    );

    setLoading(false);

    if (response.ok) {
      toast.success("Password added successfully!");
      router.push("/dashboard");
      setDomainName("");
      setPassword("");
      setLink("");
    } else {
      const errorText = await response.text();
      toast.error(`Failed to add password: ${errorText}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="bg-gray-800 bg-opacity-70 backdrop-blur-lg shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400">
            <span className="text-white">Biopass</span> Password Manager
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-modern bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-full text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <div className="glass-card p-8 animate-fadeIn">
            <div className="text-center mb-8">
              <div className="inline-block p-3 bg-blue-500 bg-opacity-20 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold">Add Password</h2>
              <p className="text-gray-400 mt-2">Securely store your new credentials</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="domain_name" className="block text-sm font-medium text-gray-300 mb-1">
                  Domain Name
                </label>
                <div className="relative">
                  <div className="icon-container-left">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    id="domain_name"
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value)}
                    className="input-modern input-icon-left"
                    placeholder="example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="icon-container-left">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-modern input-icon-left input-icon-right"
                    placeholder="••••••••"
                    required
                  />
                  <div 
                    className="icon-container-right flex space-x-2"
                  >
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
                    
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-1 focus:outline-none"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                
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
              </div>

              <div>
                <label htmlFor="link" className="block text-sm font-medium text-gray-300 mb-1">
                  Link
                </label>
                <div className="relative">
                  <div className="icon-container-left">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <input
                    type="url"
                    id="link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="input-modern input-icon-left"
                    placeholder="https://example.com/login"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="btn-modern btn-primary w-full py-3 flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      
      <footer className="mt-auto py-6 text-center text-gray-500 text-sm">
        <p>© 2025 Biopass Password Manager. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AddPasswordForm;
