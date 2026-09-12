"use client";

import * as faceapi from "face-api.js";
import { useEffect, useRef, useState } from "react";

function useFaceId() {
  const [faceDetected, setFaceDetected] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceCaptured, setFaceCaptured] = useState(false);

  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ✅ Load Face Detection Models Before Using
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("⏳ Loading face detection models...");
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models"); // Ensure this path is correct!
        setModelsLoaded(true);
        console.log("✅ Face detection model loaded!");
      } catch (error) {
        console.error("⚠️ Error loading face detection model:", error);
      }
    };
    loadModels();
  }, []);

  // ✅ Start Camera
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
      detectFace(); // Start detecting face as soon as camera starts
    } catch (error) {
      alert("Failed to access the camera.");
    }
  };

  // ✅ Detect Face in Real-Time with Bounding Box

  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // ✅ Ensure video is loaded
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

      // ✅ Draw bounding box around face
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const { x, y, width, height } = detections.box;
        context.strokeStyle = "blue";
        context.lineWidth = 2;
        context.strokeRect(x, y, width, height);

        // ✅ Add label "Face Confirmed"
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

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Stop running detection before capturing
    setFaceDetected(false);

    const video = videoRef.current;
    const context = canvasRef.current.getContext("2d");

    if (!context) return;

    // ✅ Detect face before capturing
    const detections = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions()
    );

    if (!detections) {
      alert("No face detected! Try again.");
      return;
    }

    console.log("✅ Face detected! Attempting to capture...");

    const { x, y, width, height } = detections.box; // Face bounding box

    // ✅ Crop only the detected face
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
        height, // Source (bounding box)
        0,
        0,
        width,
        height // Destination (cropped face)
      );

      const faceImageDataUrl = faceCanvas.toDataURL("image/png", 0.8);
      setImageData(faceImageDataUrl);
      setFaceCaptured(true);

      console.log("✅ Image Captured!");

      // ✅ Stop the camera **after** capturing
      setIsCameraOpen(false);
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  // ✅ Keep face detection running while camera is open
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCameraOpen) {
      interval = setInterval(detectFace, 500);
    }
    return () => clearInterval(interval);
  }, [isCameraOpen]);

  return [
    faceDetected,
    imageData,
    isCameraOpen,
    modelsLoaded,
    faceCaptured,
    videoRef,
    canvasRef,
    // startCamera,
    // captureImage,
  ];
}

export default useFaceId;
