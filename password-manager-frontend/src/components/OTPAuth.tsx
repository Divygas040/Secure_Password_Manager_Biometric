"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";

export default function OTPAuth() {
  const { setIsOTPVerified } = useAuth();
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Set up references for OTP inputs
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
    setMounted(true);
  }, []);

  // Handle input changes and auto-focus next input
  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.substring(0, 1);
    }
    
    const newOtpCode = [...otpCode];
    newOtpCode[index] = value;
    setOtpCode(newOtpCode);
    
    // Auto focus next input if current input has a value
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle key down events for navigation between inputs
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP verification
  const verifyOTP = async () => {
    const code = otpCode.join("");
    if (code.length !== 6) {
      toast.error("Please enter a complete 6-digit code");
      return;
    }

    setLoading(true);

    try {
      // Simulate API call to backend
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo purposes, always succeed
      setIsOTPVerified(true);
      toast.success("OTP Verified Successfully");
    } catch (error) {
      toast.error("Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-md mx-auto ${mounted ? 'animate-fadeIn' : ''}`}>
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </span>
        </div>
        <h3 className="text-2xl font-bold mb-2">Two-Factor Authentication</h3>
        <p className="text-gray-400 mb-6">Enter the 6-digit code from your authenticator app</p>
      </div>

      {/* Toggle between QR and OTP */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${!showQR ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
            onClick={() => setShowQR(false)}
          >
            Enter Code
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${showQR ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
            onClick={() => setShowQR(true)}
          >
            Scan QR
          </button>
        </div>
      </div>

      {showQR ? (
        <div className={`glass-card p-8 text-center ${mounted ? 'animate-slideUp' : ''}`}>
          <p className="mb-4 text-gray-400 text-sm">Scan this QR code with your authenticator app</p>
          <div className="bg-white p-4 rounded-lg inline-block mb-4">
            <QRCodeSVG 
              value="otpauth://totp/BioPass:user@example.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=BioPass" 
              size={200} 
              className="mx-auto"
            />
          </div>
          <p className="text-sm text-gray-500">
            Or enter this code manually: <span className="font-mono bg-gray-800 px-2 py-1 rounded">HXDMVJECJJWSRB3H</span>
          </p>
        </div>
      ) : (
        <div className={`${mounted ? 'animate-slideUp' : ''}`}>
          {/* OTP Input Fields */}
          <div className="flex gap-2 justify-center mb-6">
            {otpCode.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                className="w-12 h-14 text-center text-xl font-semibold bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-300"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Verification Button */}
          <button
            onClick={verifyOTP}
            disabled={loading || otpCode.join("").length !== 6}
            className="btn-modern btn-primary w-full flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </button>

          {/* Resend code / Help */}
          <div className="text-center mt-4">
            <button className="text-sm text-blue-500 hover:text-blue-400 transition duration-300">
              Didn't receive a code?
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
