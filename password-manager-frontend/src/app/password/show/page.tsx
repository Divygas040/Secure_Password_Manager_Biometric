"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import * as faceapi from "face-api.js";

interface PasswordEntry {
  domain_name: string;
  link: string;
  password: string;
}

export default function ShowPasswordPage() {
  const token = localStorage.getItem("access_token");

  const { setIsFaceVerified, isOTPVerified, setIsOTPVerified } = useAuth();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [isVerified, setIsVerified] = useState(false); // For face verification status
  const [faceDetected, setFaceDetected] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  // imageBlob will store the actual blob for uploading
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [faceIdVerified, setFaceIdVerified] = useState<boolean>(false);
  const router = useRouter();
  const { setIsAuthenticated } = useAuth();
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  const [isVerifyingFace, setIsVerifyingFace] = useState(false);

  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load face detection models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("⏳ Loading face detection models...");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(
          "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/"
        );
        await faceapi.nets.tinyFaceDetector.loadFromUri(
          "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/"
        );
        await faceapi.nets.faceLandmark68Net.loadFromUri(
          "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/"
        );
        await faceapi.nets.faceRecognitionNet.loadFromUri(
          "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/"
        );
        setModelsLoaded(true);
        console.log("✅ Face detection models loaded!");
      } catch (error) {
        console.error("⚠️ Error loading face detection model:", error);
      }
    };
    loadModels();
  }, []);

  // Fetch user data and face image from backend
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("⏳ Loading face detection models...");
        // Ensure the /models path is correctly served (e.g., in public folder)
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        setModelsLoaded(true);
        console.log("✅ Face detection model loaded!");
      } catch (error) {
        console.error("⚠️ Error loading face detection model:", error);
      }
    };

    loadModels();
  }, []);

  // Start the camera and begin face detection
  const startCamera = async () => {
    if (!modelsLoaded) {
      alert("Face detection model is still loading. Please wait...");
      return;
    }

    setIsCameraOpen(true);
    setFaceDetected(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      detectFace();
    } catch (error) {
      alert("Failed to access the camera.");
    }
  };

  // Detect face in real-time and draw bounding box
  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("⏳ Waiting for video to load...");
      return;
    }

    const detections = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions()
    );

    if (detections) {
      setFaceDetected(true);
      console.log("✅ Face detected!");

      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const { x, y, width, height } = detections.box;
        context.strokeStyle = "blue";
        context.lineWidth = 2;
        context.strokeRect(x, y, width, height);
        context.fillStyle = "blue";
        context.fillRect(x, y - 20, width, 20);
        context.fillStyle = "white";
        context.font = "14px Arial";
        context.fillText("Face Confirmed", x + 5, y - 5);
      }
    } else {
      setFaceDetected(false);
    }
  };

  // Capture image and show the captured image instead of the camera feed
  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setFaceDetected(false);
    const video = videoRef.current;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    const detections = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions()
    );

    if (!detections) {
      toast.error("No face detected! Please position your face properly and try again.");
      return;
    }

    console.log("✅ Face detected! Attempting to capture...");
    
    // Create a high-quality capture of the entire face
    const { x, y, width, height } = detections.box;
    
    // Add padding around the face (20% on each side)
    const paddingX = Math.floor(width * 0.2);
    const paddingY = Math.floor(height * 0.2);
    
    // Calculate new coordinates with padding, ensuring they're within video bounds
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    const newX = Math.max(0, x - paddingX);
    const newY = Math.max(0, y - paddingY);
    const newWidth = Math.min(width + (paddingX * 2), videoWidth - newX);
    const newHeight = Math.min(height + (paddingY * 2), videoHeight - newY);

    // Create a temporary canvas to crop the face region
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = newWidth;
    faceCanvas.height = newHeight;
    const faceCtx = faceCanvas.getContext("2d");

    if (faceCtx) {
      // Draw the video frame to the canvas with the calculated dimensions
      faceCtx.drawImage(
        video,
        newX, newY, newWidth, newHeight, // Crop area from the video
        0, 0, newWidth, newHeight // Draw onto temporary canvas
      );

      // Convert the cropped face to a Blob and create an object URL for display
      faceCanvas.toBlob(
        (blob) => {
          if (blob) {
            const imageUrl = URL.createObjectURL(blob);
            setImageData(imageUrl);
            setImageBlob(blob); // Store the blob directly for upload
            setFaceCaptured(true);
            console.log("✅ Image Captured!");
            toast.success("Face captured successfully");

            // Stop the camera after capturing
            setIsCameraOpen(false);
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
          } else {
            toast.error("Failed to process the captured image. Please try again.");
          }
        },
        "image/png",
        0.95 // Higher quality
      );
    }
  };

  // Keep face detection running while the camera is open
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCameraOpen) {
      interval = setInterval(detectFace, 500);
    }
    return () => clearInterval(interval);
  }, [isCameraOpen]);

  // Handle sending OTP request
  const handleSendOTP = async () => {
    try {
      toast.loading("Sending OTP to your email...");
      
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.dismiss();
        toast.error("You must be logged in to send OTP.");
        return;
      }
      
      const response = await fetch(
        "http://127.0.0.1:8000/api/users/send-otp-email/",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      toast.dismiss();
      
      const data = await response.json();
      if (response.ok) {
        setOtpSent(true); // Mark OTP as sent
        
        // When skipping face verification, consider clearing those UI elements
        if (verificationAttempted && !faceIdVerified) {
          resetFaceVerification();
          setVerificationAttempted(false);
        }
        
        const userEmail = data.user.email;
        toast.success(`OTP has been sent to your email: ${userEmail}`);
      } else {
        toast.error(data.error || "Failed to send OTP.");
      }
    } catch (error) {
      toast.dismiss();
      console.error("Error sending OTP:", error);
      toast.error("Error sending OTP.");
    }
  };

  // Handle OTP submission and fetch passwords from backend
  const handleOTPSubmit = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("You must be logged in to view passwords.");
        return;
      }
      const response = await fetch(
        `http://127.0.0.1:8000/api/users/verify-otp/?otp=${otp}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        setPasswords(data); // Set the passwords if OTP is verified successfully
        setIsOTPVerified(true);
        setIsVerified(true);
        toast.success("Passwords fetched successfully!");
      } else {
        toast.error(data.error || "Failed to verify OTP.");
      }
    } catch (error) {
      console.error("Error submitting OTP:", error);
      toast.error("An error occurred while submitting the OTP.");
    }
  };
  const uploadFaceId = async () => {
    try {
      if (!imageBlob) {
        toast.error("No face image captured. Please try again.");
        return;
      }

      // Show loading state
      setIsVerifyingFace(true);
      
      const formData = new FormData();
      // Use the stored blob directly
      formData.append("image", imageBlob, "face.png");

      const response = await fetch(
        "http://127.0.0.1:8000/api/users/verify-face-id/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      
      // Verification completed
      setIsVerifyingFace(false);
      setVerificationAttempted(true);

      if (response.ok) {
        toast.success(data.message || "Face ID verified successfully!");
        setFaceIdVerified(true);
        setIsFaceVerified(true);
      } else {
        // Handle specific error messages from the backend
        const errorMessage = data.error || "Face ID verification failed. Please try again.";
        toast.error(errorMessage);
        
        // Reset states if verification fails, but keep the captured image for reference
        setFaceIdVerified(false);
        setIsFaceVerified(false);
        
        // If the error is related to no face ID being set up, redirect to dashboard
        if (response.status === 404 && errorMessage.includes("No face ID found")) {
          router.push("/dashboard");
        }
      }
    } catch (error) {
      console.error("⚠️ Error during face verification:", error);
      toast.error("An unexpected error occurred. Please try again.");
      
      // Reset states on error
      setFaceIdVerified(false);
      setIsFaceVerified(false);
      setIsVerifyingFace(false);
      setVerificationAttempted(true);
    }
  };

  // Show passwords after face verification
  const handleShowPasswords = () => {
    setIsVerified(true);
  };

  const resetFaceVerification = () => {
    // Clear all face verification related states
    setFaceIdVerified(false);
    setFaceCaptured(false);
    setImageData(null);
    setImageBlob(null);
    setFaceDetected(false);
    setIsFaceVerified(false);
    setIsVerifyingFace(false);
    setVerificationAttempted(false);
  };

  const handleTryAgain = () => {
    // Reset states and start camera again
    resetFaceVerification();
    setVerificationAttempted(false);
    startCamera();
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
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-8 animate-fadeIn">
            <div className="text-center mb-8">
              <div className="inline-block p-3 bg-green-500 bg-opacity-20 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold">View Passwords</h2>
              <p className="text-gray-400 mt-2">Verify your identity to access your secure credentials</p>
            </div>

            {/* Face ID Verification Section */}
            {!isCameraOpen && !faceCaptured && !faceIdVerified && (
              <div className="space-y-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Face Verification
                  </h3>
                  <p className="text-gray-400 mb-4">Verify your identity with face recognition for enhanced security.</p>
                  <button
                    onClick={startCamera}
                    className="btn-modern btn-primary w-full py-3 flex items-center justify-center"
                    disabled={!modelsLoaded}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {modelsLoaded ? "Start Face Verification" : "Loading Face Models..."}
                  </button>
                </div>
              </div>
            )}

            {/* Camera View */}
            {isCameraOpen && (
              <div className="mb-6 space-y-4">
                <div className="relative w-full max-w-md mx-auto rounded-lg overflow-hidden shadow-xl border-2 border-blue-500">
              <video
                ref={videoRef}
                autoPlay
                    muted
                    className="w-full h-64 object-cover"
              />
              <canvas
                ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full"
              />
                </div>
                
                <div className="flex space-x-3 justify-center">
              <button
                onClick={captureImage}
                    disabled={!faceDetected}
                    className={`btn-modern ${
                      faceDetected ? "btn-primary" : "bg-gray-700 cursor-not-allowed"
                    } flex-1 py-2 flex items-center justify-center`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Capture Face
                  </button>
                  <button
                    onClick={() => {
                      setIsCameraOpen(false);
                      const stream = videoRef.current?.srcObject as MediaStream;
                      stream?.getTracks().forEach((track) => track.stop());
                    }}
                    className="btn-modern bg-red-600 hover:bg-red-700 flex-1 py-2 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
              </button>
                </div>
            </div>
          )}

            {/* Show captured face before verification */}
            {!faceIdVerified && faceCaptured && imageData && !verificationAttempted && !isVerifyingFace && (
              <div className="text-center mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-gray-300 mb-3">Captured Face:</p>
                <div className="relative w-32 h-32 mx-auto">
                  <img
                    src={imageData}
                    alt="Captured Face"
                    className="w-full h-full object-cover rounded-full border-2 border-blue-500"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-green-500 p-1 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col space-y-3 mt-4">
                  <button
                    className="btn-modern btn-primary w-full py-2 flex items-center justify-center"
                    onClick={uploadFaceId}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verify Face ID
                  </button>
                  <button
                    className="btn-modern bg-gray-700 hover:bg-gray-600 w-full py-2 flex items-center justify-center"
                    onClick={handleTryAgain}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                </div>
              </div>
            )}
            
            {/* Verification Loading Indicator */}
            {isVerifyingFace && (
              <div className="text-center mt-6 p-8 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500 bg-opacity-20 flex items-center justify-center animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Verifying Your Face</h3>
                <p className="text-gray-300">Please wait while we verify your identity...</p>
                <div className="mt-4 relative h-2 max-w-xs mx-auto bg-gray-700 rounded-full overflow-hidden">
                  <div className="absolute top-0 left-0 h-full bg-blue-500 animate-progress-bar"></div>
                </div>
              </div>
            )}

            {/* Failed Verification Message - only show after verification attempt and not during verification */}
            {!faceIdVerified && !isCameraOpen && faceCaptured && verificationAttempted && !isVerifyingFace && (
              <div className="mt-6 p-6 bg-red-900 bg-opacity-30 rounded-lg border border-red-700 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-red-800 bg-opacity-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Face Verification Failed</h3>
                <p className="text-gray-300 mb-6">Your face could not be verified. Please try again or use another verification method.</p>
                
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={handleTryAgain}
                    className="btn-modern bg-red-600 hover:bg-red-700 w-full py-3 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Face Verification Again
                  </button>
                </div>
              </div>
            )}

            {/* OTP Verification Section */}
            {(faceIdVerified || otpSent) && !isVerified && (
              <div className="mt-8">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Two-Factor Authentication
                  </h3>
                  <p className="text-gray-400 mb-4">Verify with an OTP sent to your email for additional security.</p>
                  
            {!otpSent ? (
              <button
                onClick={handleSendOTP}
                      className="btn-modern bg-purple-600 hover:bg-purple-700 w-full py-3 flex items-center justify-center"
              >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send OTP to Email
              </button>
            ) : (
              !isVerified && (
                      <div className="mt-4 space-y-4">
                        <div className="relative">
                          <div className="icon-container-left">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                            className="input-modern input-icon-left"
                  />
                        </div>
                  <button
                    onClick={handleOTPSubmit}
                          className="btn-modern btn-primary w-full py-2 flex items-center justify-center"
                  >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Verify OTP
                  </button>
                </div>
              )
            )}
                </div>
          </div>
        )}
        {isVerified && (
  <div className="mt-8 text-center p-8 bg-green-800 bg-opacity-30 rounded-lg border border-green-600">
    <div className="flex justify-center mb-4">
      <div className="w-20 h-20 rounded-full bg-green-600 bg-opacity-60 flex items-center justify-center animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
    <h3 className="text-2xl font-bold text-white mb-2">Two-Factor Authentication Complete 🎉</h3>
    <p className="text-gray-200">You’ve successfully verified your identity!</p>
  </div>
)}

            {/* Password Table */}
            {isVerified && passwords.length > 0 && (
              <div className="mt-8 animate-fadeIn">
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Your Secure Passwords
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full bg-gray-800 text-white rounded-lg overflow-hidden border border-gray-700">
              <thead>
                <tr className="bg-gray-900">
                        <th className="py-3 px-4 text-left font-semibold">Domain</th>
                        <th className="py-3 px-4 text-left font-semibold">Link</th>
                        <th className="py-3 px-4 text-left font-semibold">Password</th>
                </tr>
              </thead>
              <tbody>
                {passwords.map((entry, index) => (
                        <tr key={index} className={`border-t border-gray-700 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700'}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                              </svg>
                              <span className="font-medium">{entry.domain_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <a 
                              href={entry.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 hover:underline flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              {entry.link.length > 30 ? `${entry.link.substring(0, 30)}...` : entry.link}
                            </a>
                          </td>
                          <td className="py-3 px-4 relative group">
                            <div className="flex items-center">
                              <span className="font-mono bg-gray-700 px-2 py-1 rounded select-all">{entry.password}</span>
                              <button 
                                className="ml-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  navigator.clipboard.writeText(entry.password);
                                  toast.success("Password copied to clipboard!");
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                              </button>
                            </div>
                          </td>
                  </tr>
                ))}
              </tbody>
            </table>
                </div>
              </div>
            )}

            {/* No Passwords Message */}
            {isVerified && passwords.length === 0 && (
              <div className="mt-8 text-center p-8 bg-gray-800 rounded-lg border border-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-xl font-semibold mb-2">No Passwords Found</h3>
                <p className="text-gray-400 mb-4">You haven't added any passwords yet.</p>
                <button
                  onClick={() => router.push("/password/add")}
                  className="btn-modern btn-primary py-2 px-6 inline-flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Your First Password
                </button>
          </div>
        )}
      </div>
        </div>
      </main>
      
      <footer className="mt-auto py-6 text-center text-gray-500 text-sm">
        <p>© 2025 Biopass Password Manager. All rights reserved.</p>
      </footer>
    </div>
  );
}