"use client"; // Ensure this is also marked as a client component
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function FaceAuth() {
  const { setIsFaceVerified } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFaceScan = async () => {
    setLoading(true);
    setScanning(true);
    
    // Simulate the scan progress animation
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
    
    // Simulate API call to backend for face verification
    setTimeout(() => {
      clearInterval(interval);
      setScanProgress(100);
      
      setTimeout(() => {
        setIsFaceVerified(true);
        setScanning(false);
        setLoading(false);
        toast.success("Face ID Verified Successfully");
      }, 500);
    }, 2500);
  };

  return (
    <div className={`w-full max-w-md mx-auto ${mounted ? 'animate-fadeIn' : ''}`}>
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 relative">
            <div className="absolute inset-0 rounded-full bg-blue-600 bg-opacity-20 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-12 w-12 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <h3 className="text-2xl font-bold mb-2">Face Recognition</h3>
        <p className="text-gray-400 mb-6">Secure authentication using your face</p>
      </div>

      <div className={`glass-card p-8 ${mounted ? 'animate-slideUp' : ''}`}>
        {scanning ? (
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48 mb-6">
              {/* Face scanning animation */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full border-2 border-blue-500 flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border border-blue-400 flex items-center justify-center">
                    <div className="w-28 h-28 rounded-full border border-blue-300 flex items-center justify-center">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-16 w-16 text-blue-500" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5} 
                          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Scanning line animation */}
              <div 
                className="absolute inset-x-0 bg-blue-500 opacity-50"
                style={{
                  top: `${scanProgress/2}%`,
                  height: '2px',
                  animation: 'pulse 1.5s infinite'
                }}
              ></div>
              
              {/* Moving dots to indicate scanning */}
              <div className="absolute inset-0">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-blue-500 rounded-full animate-ping"
                    style={{
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '1.5s'
                    }}
                  ></div>
                ))}
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
            <p className="text-blue-500">Scanning face... {scanProgress}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-6 w-48 h-48 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-20 w-20 text-gray-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
            <p className="text-gray-400 mb-6 text-center">
              Position your face in front of the camera for quick and secure authentication
            </p>
            <button
              onClick={handleFaceScan}
              className="btn-modern btn-primary w-full flex items-center justify-center"
              disabled={loading}
            >
              {loading ? "Processing..." : "Start Face Scan"}
            </button>
          </div>
        )}
      </div>

      {/* Privacy Note */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          Your face data is processed securely and never shared with third parties.
          <br />
          <span className="text-blue-500 cursor-pointer">Learn more about our privacy policy</span>
        </p>
      </div>
    </div>
  );
}
