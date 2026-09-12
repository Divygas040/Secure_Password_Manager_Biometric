"use client";

import React, { useEffect, useState } from 'react';

interface CelebrationProps {
  message?: string;
}

const Celebration: React.FC<CelebrationProps> = ({ message = "Success!" }) => {
  const [confetti, setConfetti] = useState<React.ReactNode[]>([]);
  
  useEffect(() => {
    // Generate confetti pieces
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff69b4'];
    const confettiPieces: React.ReactNode[] = [];
    
    for (let i = 0; i < 150; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = `${Math.random() * 100}%`;
      const width = `${Math.random() * 10 + 5}px`;
      const height = `${Math.random() * 20 + 10}px`;
      const duration = `${Math.random() * 3 + 2}s`;
      const delay = `${Math.random() * 0.5}s`;
      const rotationDuration = `${Math.random() * 3 + 2}s`;
      
      confettiPieces.push(
        <div
          key={i}
          className="confetti"
          style={{
            left,
            width,
            height,
            '--confetti-color': color,
            animationDuration: `${duration}, ${rotationDuration}`,
            animationDelay: delay,
          } as React.CSSProperties}
        />
      );
    }
    
    setConfetti(confettiPieces);
    
    // Clean up after animation
    const timer = setTimeout(() => {
      setConfetti([]);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <>
      <div className="confetti-container">
        {confetti}
      </div>
      <div className="success-overlay">
        <div className="success-content text-center">
          <div className="mb-4">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-32 w-32 text-green-500 celebration-icon mx-auto"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path 
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">{message}</h2>
          <p className="text-xl text-gray-200">Your passwords are now available!</p>
        </div>
      </div>
    </>
  );
};

export default Celebration; 