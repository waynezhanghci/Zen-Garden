
import React, { useState, useCallback } from 'react';
import { FlowerGarden } from './components/FlowerGarden';

const App: React.FC = () => {
  const [score, setScore] = useState(0);
  const [isGestureEnabled, setIsGestureEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // Default to false so user clicks Start

  const handleHarvest = useCallback(() => {
    setScore(prev => prev + 1);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans">
      {/* Canvas Layer */}
      <FlowerGarden 
        onHarvest={handleHarvest} 
        isGestureEnabled={isGestureEnabled} 
        isPlaying={isPlaying}
      />
      
      {/* Top Left - Title (Large) */}
      <div className="absolute top-8 left-8 pointer-events-none z-20 select-none">
         <h1 className="text-white/90 text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.2em] uppercase drop-shadow-md opacity-90 font-serif">
          Zen Garden
        </h1>
      </div>
      
      {/* Top Right - Score Card */}
      <div className="absolute top-6 right-6 flex flex-col items-end pointer-events-none z-20 select-none">
        {/* Score Card - Elegant Frosted Glass */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 flex flex-col items-center min-w-[120px] shadow-2xl transition-transform duration-300">
          <span className="text-white/70 text-[10px] font-bold uppercase tracking-[0.25em] mb-2">
            Narcissus
          </span>
          <span className="text-white text-6xl font-extralight tracking-tighter leading-none font-serif">
            {score}
          </span>
        </div>
      </div>

      {/* Bottom Center - Play/Pause Button */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`
            group relative flex items-center justify-center gap-3 px-8 py-3 
            rounded-full backdrop-blur-md border border-white/20 shadow-2xl 
            transition-all duration-500 ease-out overflow-hidden
            ${isPlaying 
              ? 'bg-white/10 hover:bg-white/20 text-white' 
              : 'bg-white/90 hover:bg-white text-emerald-900'
            }
          `}
        >
          {/* Icon */}
          <div className="relative z-10 w-4 h-4">
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full ml-0.5">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            )}
          </div>
          
          {/* Text */}
          <span className="relative z-10 text-xs font-bold uppercase tracking-[0.25em]">
            {isPlaying ? '暂停' : '开始'}
          </span>

          {/* Glow Effect */}
          <div className={`
            absolute inset-0 transition-opacity duration-500
            ${isPlaying ? 'opacity-0' : 'opacity-100'}
            bg-gradient-to-r from-transparent via-white/50 to-transparent
            -translate-x-full group-hover:translate-x-full transform
          `} />
        </button>
      </div>

      {/* Bottom Left - Gesture Control Toggle */}
      <div className="absolute bottom-8 left-8 z-30 flex items-center gap-4 bg-black/20 backdrop-blur-md p-4 rounded-full border border-white/10 hover:bg-black/30 transition-colors">
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={isGestureEnabled}
            onChange={(e) => setIsGestureEnabled(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-500/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500/80"></div>
          <span className="ms-3 text-sm font-medium text-white/80 tracking-widest uppercase text-xs">
            手势
          </span>
        </label>
      </div>
    </div>
  );
};

export default App;
