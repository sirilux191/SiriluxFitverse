import React, { useState, useEffect } from "react";
import { Heart, Apple, Dumbbell, Leaf } from "lucide-react";

const phrases = [
  "Take care of your body. It's the only place you have to live.",
  "A healthy outside starts from the inside.",
  "Wellness is the key to a happy life.",
  "Healthy habits lead to a healthy life.",
  "Nourish your body, mind, and soul.",
  "An apple a day keeps the doctor away.",
  "Physical fitness is the first requisite of happiness.",
  "Health is wealth.",
  "Listen to your body; it knows best.",
  "Every step towards a healthier lifestyle counts.",
];

// Health icons for the game
const healthIcons = [
  { icon: Heart, color: "text-red-500" },
  { icon: Apple, color: "text-green-500" },
  { icon: Dumbbell, color: "text-blue-500" },
  { icon: Leaf, color: "text-emerald-400" },
];

const LoadingScreen = () => {
  const [phrase, setPhrase] = useState("");
  const [score, setScore] = useState(0);
  const [gameItems, setGameItems] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [progress, setProgress] = useState(0);

  // Random phrase effect
  useEffect(() => {
    const setRandomPhrase = () => {
      const randomIndex = Math.floor(Math.random() * phrases.length);
      setPhrase(phrases[randomIndex]);
    };

    setTimeout(setRandomPhrase, 500);
    const interval = setInterval(setRandomPhrase, 3000);
    return () => clearInterval(interval);
  }, []);

  // Game logic
  useEffect(() => {
    if (!gameStarted) return;

    // Generate a new health item every 1 second
    const gameInterval = setInterval(() => {
      const randomIcon =
        healthIcons[Math.floor(Math.random() * healthIcons.length)];
      const newItem = {
        id: Date.now(),
        x: Math.floor(Math.random() * 80) + 10, // 10-90% of screen width
        y: 0,
        icon: randomIcon.icon,
        color: randomIcon.color,
        value: Math.floor(Math.random() * 3) + 1, // 1-3 points
      };

      setGameItems((prev) => [...prev, newItem]);
    }, 1000);

    // Move items down and remove those that fall off screen
    const moveInterval = setInterval(() => {
      setGameItems(
        (prev) =>
          prev
            .map((item) => ({ ...item, y: item.y + 5 }))
            .filter((item) => item.y < 100) // Remove items that fall off screen
      );
    }, 200);

    return () => {
      clearInterval(gameInterval);
      clearInterval(moveInterval);
    };
  }, [gameStarted]);

  // Start game when component mounts
  useEffect(() => {
    setGameStarted(true);
    return () => setGameStarted(false);
  }, []);

  // Simulate loading progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Slowly increment progress but never reach 100%
        const increment = Math.random() * 3;
        return prev < 95 ? prev + increment : prev;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleItemClick = (id, value) => {
    // Visual feedback on click
    const audio = new Audio("/sounds/pop.mp3");
    audio.volume = 0.2;
    audio.play().catch((e) => console.log("Audio play failed", e));

    // Show floating score animation
    const item = gameItems.find((item) => item.id === id);
    if (item) {
      const scoreIndicator = document.createElement("div");
      scoreIndicator.textContent = `+${value}`;
      scoreIndicator.className =
        "absolute text-xl font-bold text-primary animate-scoreFloat z-50";
      scoreIndicator.style.left = `${item.x}%`;
      scoreIndicator.style.top = `${item.y}%`;
      document.getElementById("game-area").appendChild(scoreIndicator);

      setTimeout(() => {
        scoreIndicator.remove();
      }, 1000);
    }

    setScore((prev) => prev + value);
    setGameItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden bg-gradient-to-br from-green-800 via-green-900 to-slate-900 p-4">
      {/* Circular background elements - matching app style */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="circlePosition w-11/12 h-11/12 bg-gradient-radial from-green-400/10 to-transparent rounded-full absolute -z-10 blur-[100px] flex justify-center items-center">
          <div className="circle w-[17rem] h-[17rem] bg-gradient-radial from-emerald-300/15 to-transparent rounded-full" />
        </div>

        {/* Additional particles */}
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/10"
            style={{
              width: `${Math.random() * 20 + 5}px`,
              height: `${Math.random() * 20 + 5}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 10 + 15}s`,
            }}
          ></div>
        ))}
      </div>

      {/* Loading message */}
      <div className="z-10 text-center mb-8 backdrop-blur-sm bg-white/10 p-4 rounded-xl shadow-lg max-w-md">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          Loading
        </h2>
        <div className="flex items-center justify-center gap-1 mb-2">
          <span
            className="inline-block w-2 h-2 bg-white rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></span>
          <span
            className="inline-block w-2 h-2 bg-white rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></span>
          <span
            className="inline-block w-2 h-2 bg-white rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></span>
        </div>
        <p className="text-sm text-white/80 italic font-medium">{phrase}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md h-2 mb-6 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Game area */}
      <div
        id="game-area"
        className="relative w-full max-w-md h-72 rounded-xl overflow-hidden mb-6 backdrop-blur-md bg-white/10 border border-white/20 shadow-xl"
      >
        {/* Glass panel effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

        {/* Score display */}
        <div className="absolute top-3 right-3 bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md z-10 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
              clipRule="evenodd"
            />
          </svg>
          <span>{score}</span>
        </div>

        {/* Game instructions */}
        <div className="absolute top-3 left-3 text-xs bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full font-medium z-10 shadow-sm">
          Catch health items for points!
        </div>

        {/* Falling game items with animation */}
        {gameItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              className={`absolute ${item.color} transition-all hover:scale-125 focus:outline-none cursor-pointer animate-wobble`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: `translateX(-50%) rotate(${Math.sin(item.y * 0.1) * 15}deg)`,
                animationDelay: `${(item.id % 5) * 0.1}s`,
              }}
              onClick={() => handleItemClick(item.id, item.value)}
              aria-label="Click to collect health item"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-white/30 rounded-full blur-sm transform scale-110"></div>
                <IconComponent
                  size={32}
                  className="drop-shadow-md relative z-10"
                  strokeWidth={1.5}
                />
                <span className="absolute -top-2 -right-2 bg-gradient-to-br from-primary to-primary/80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md">
                  {item.value}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional loading text */}
      <p className="text-sm text-white/70 text-center font-medium max-w-md">
        Please wait while we're securely connecting to the blockchain and
        preparing your health data...
      </p>
    </div>
  );
};

export default LoadingScreen;
