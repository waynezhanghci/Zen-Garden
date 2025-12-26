
// Visual Colors
export const COLORS = {
  // Background Gradient Stops - Solid Klein Blue
  bgTop: '#002FA7',    // Klein Blue
  bgBottom: '#002FA7', // Klein Blue
  
  // Rich Flower Palette
  // Petals: Pure White
  petalGradientStart: '#FFFFFF', 
  petalGradientEnd: '#F0F8FF',   // Very subtle AliceBlue for minimal shading without grayness
  
  // Core: Bright Fluorescent Lemon Yellow
  coreGradientStart: '#f9f047',  // Bright Lemon Yellow
  coreGradientEnd: '#e6dd25',    // Slightly deeper lemon for volume
  coreCenterColor: '#f1fcd4',    // Very pale yellow-green for center detail
  stamenColor: '#FFFFFF',        // White highlights
  
  // Bud Decoration
  budColor: '#d2e69c',           // Unified Bright Tender Green (User specified previously)
  budLineColor: '#9ab865',       // Darker, natural shade of budColor for texture definition

  // Stem Palette: 4 Specific Green Gradients with Saturation Boosted by ~20%
  // Configured as Base (Darker) -> Tip (Lighter/Brighter) for natural lighting and transparency
  stemPalette: [
    { base: '#8AC800', tip: '#A4EB00' }, // Onion Green: More vivid Lime
    { base: '#96D432', tip: '#B2F040' }, // Bean Green: Removed grey, brighter yellow-green
    { base: '#8CCF36', tip: '#A8EB44' }, // Bean Cyan: Cleaner, more saturated green
    { base: '#00B812', tip: '#00DB16' }, // Oil Green: Intense Neon Green
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
