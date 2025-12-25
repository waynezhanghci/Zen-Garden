
// Visual Colors
export const COLORS = {
  // Background Gradient Stops
  bgTop: '#052b52',    // Deep Midnight Blue (Top) - Matches the reference upper tone
  bgBottom: '#000000', // Pure Black (Bottom)
  
  // Rich Flower Palette (Gradient support)
  petalGradientStart: '#FFFFFF', // Pure White tip
  petalGradientEnd: '#E8E8E8',   // Light Gray base (shadow)
  coreGradientStart: '#FFD700',  // Gold
  coreGradientEnd: '#FFA500',    // Orange depth
  stamenColor: '#FFFFE0',        // Pale Yellow stamen

  // Stem Palette: Multi-color green combinations + Vertical Gradients
  // Covering: Deep Emerald, Olive, Tender Yellow, Pale Mint, Dark Ink
  stemPalette: [
    { base: '#004526', tip: '#98FB98' }, // Deep Emerald -> Pale Mint (深翠绿 -> 浅薄荷)
    { base: '#2F3815', tip: '#ADFF2F' }, // Deep Olive -> Tender Yellow Green (橄榄 -> 嫩黄绿)
    { base: '#022119', tip: '#E1FF6B' }, // Dark Ink Green -> Bright Tender Yellow (墨绿 -> 嫩黄)
    { base: '#1E4D2B', tip: '#90EE90' }, // Forest Green -> Light Green (Classic)
    { base: '#0D2B26', tip: '#7FFFD4' }, // Dark Sea -> Aquamarine (Cool Tone)
    { base: '#3A4B06', tip: '#CCFF00' }, // Brownish Olive -> Electric Lime (Vibrant)
  ]
};

// Gameplay Settings
export const GAME_SETTINGS = {
  flowerCount: 46, 
  growthDuration: 18, 
  stemWidthBase: 8,
  stemWidthTip: 4,
  swayAmplitude: 20,
};

// Particle Settings
export const PARTICLE_SETTINGS = {
  gravity: 0.15,
  friction: 0.94,
  explodeCount: 40,
};
