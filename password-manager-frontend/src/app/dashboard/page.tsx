"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import * as faceapi from "face-api.js";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const router = useRouter();
  const { setIsAuthenticated } = useAuth();
  const [username, setUsername] = useState("Loading...");
  const [faceIdExists, setFaceIdExists] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  // imageData will store an object URL for the captured face image
  const [imageData, setImageData] = useState<string | null>(null);
  // imageBlob will store the actual blob for uploading
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceCaptured, setFaceCaptured] = useState(false);

  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const checkIfFaceIdExists = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/users/image/", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        // If the face image exists, the backend should return 200
        if (response.status === 200) {
          setFaceIdExists(true);
        }
      } catch (error) {
        console.error("⚠️ Error fetching face ID status:", error);
      }
    };

    const fetchUserDetails = async () => {
      const refreshToken = localStorage.getItem("refresh_token");

      if (!token) {
        setUsername("Guest");
        console.error("❌ No access token found in localStorage");
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:8000/api/users/me/", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUsername(data.username);
        } else if (response.status === 401 && refreshToken) {
          // Attempt to refresh token
          const refreshResponse = await fetch(
            "http://127.0.0.1:8000/api/token/refresh/",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ refresh: refreshToken }),
            }
          );

          if (refreshResponse.ok) {
            const { access, refresh } = await refreshResponse.json();
            localStorage.setItem("access_token", access);
            localStorage.setItem("refresh_token", refresh);

            // Retry fetching user data with the new access token
            const retryResponse = await fetch(
              "http://127.0.0.1:8000/api/users/me/",
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${access}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (retryResponse.ok) {
              const data = await retryResponse.json();
              setUsername(data.username);
            } else {
              setUsername("Guest");
            }
          } else {
            setUsername("Guest");
            console.error(
              "❌ Failed to refresh token:",
              await refreshResponse.text()
            );
          }
        } else {
          setUsername("Guest");
        }
      } catch (error) {
        setUsername("Guest");
        console.error("⚠️ Error fetching user data:", error);
      }
    };

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
    fetchUserDetails();
    checkIfFaceIdExists();
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
      alert("No face detected! Try again.");
      return;
    }

    console.log("✅ Face detected! Attempting to capture...");
    const { x, y, width, height } = detections.box;

    // Create a temporary canvas to crop the face region
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = width;
    faceCanvas.height = height;
    const faceCtx = faceCanvas.getContext("2d");

    if (faceCtx) {
      faceCtx.drawImage(
        video,
        x,
        y,
        width,
        height, // Crop area from the video
        0,
        0,
        width,
        height // Draw onto temporary canvas
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

            // Stop the camera after capturing
            setIsCameraOpen(false);
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
          }
        },
        "image/png",
        0.8
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

  const uploadFaceId = async () => {
    try {
      if (!imageBlob) {
        toast.error("No face image captured. Please try again.");
        return;
      }

      toast.loading("Processing and validating your face image...");
      
      const formData = new FormData();
      // Use the stored blob directly
      formData.append("image", imageBlob, "face.png");

      console.log("Uploading image with FormData");

      const response = await fetch(
        "http://127.0.0.1:8000/api/users/image-upload/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // Do not set Content-Type manually; FormData does that automatically.
          },
          body: formData,
        }
      );

      toast.dismiss();
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      let data: any = {};
      
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error("Failed to parse JSON response:", jsonError);
          const text = await response.text();
          console.error("Response text:", text);
          toast.error(`Server error: ${response.status} ${response.statusText}`);
          return;
        }
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        toast.error(`Server error: ${response.status} ${response.statusText}`);
        return;
      }
      
      // Use response.ok to check if the response status is in the 2xx range
      if (response.ok) {
        toast.success(data.message || "Face uploaded successfully! Face ID setup complete.");
        setFaceIdExists(true);
        setImageData(null);
        setImageBlob(null);
        setFaceCaptured(false);
        // Refresh the page to reload all data
        window.location.reload();
      } else {
        console.error("Upload failed. Status:", response.status, "Data:", data);
        const errorMessage = data.error || data.message || `Upload failed with status ${response.status}. Please try again with a clearer image of your face only.`;
        toast.error(errorMessage);
        // Keep the captured image so user can try again
      }
    } catch (error: any) {
      toast.dismiss();
      console.error("⚠️ Error uploading Face:", error);
      const errorMessage = error.message || "Error uploading Face. Please try again with a clearer image.";
      toast.error(errorMessage);
    }
  };

  // Handle Sign Out
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setIsAuthenticated(false);
    router.push("/auth/login");
    toast.success("You have been logged out.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header with logout */}
      <header className="bg-gray-800 bg-opacity-70 backdrop-blur-lg shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400">
            <span className="text-white">Biopass</span> Password Manager
          </h1>
          <div className="flex items-center space-x-4">
            <div className="bg-gray-700 px-4 py-1.5 rounded-full text-sm font-medium">
              <span className="text-gray-400 mr-1">Welcome,</span> {username}
            </div>
            <button
              onClick={handleLogout}
              className="btn-modern bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-full text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Dashboard Content */}
          <div className="glass-card p-8 animate-fadeIn">
            <h2 className="text-3xl font-bold mb-8 text-center">Dashboard</h2>
            
            {!faceIdExists ? (
              <>
                <div className="text-center mb-8">
                  <p className="text-xl mb-4 text-gray-300">Setup Face ID Authentication</p>
                  <p className="text-gray-400 mb-6">
                    Enhance your account security by adding Face ID authentication. 
                    This will allow you to access your passwords securely.
                  </p>
                </div>

                {!isCameraOpen ? (
                  <button
                    onClick={startCamera}
                    className="btn-modern btn-primary w-full py-3 mb-4 flex items-center justify-center"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-5 w-5 mr-2" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Start Camera
                  </button>
                ) : (
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

                {faceCaptured && imageData && (
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
                    <button
                      className="btn-modern btn-primary w-full mt-4 py-2 flex items-center justify-center"
                      onClick={uploadFaceId}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload Face ID
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="inline-block p-3 bg-green-500 bg-opacity-20 rounded-full mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Face ID Enabled</h3>
                  <p className="text-gray-400">You can now securely manage your passwords</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    className="btn-modern bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 py-4 rounded-xl flex flex-col items-center justify-center shadow-lg hover:shadow-blue-500/20"
                    onClick={() => router.push("/password/add")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-lg font-semibold">Add Password</span>
                  </button>
                  
                  <button
                    className="btn-modern bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 py-4 rounded-xl flex flex-col items-center justify-center shadow-lg hover:shadow-green-500/20"
                    onClick={() => router.push("/password/show")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-lg font-semibold">Show Passwords</span>
                  </button>
                </div>
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
