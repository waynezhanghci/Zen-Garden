
export interface Vector2 {
  x: number;
  y: number;
}

export enum FlowerState {
  Growing,
  Blooming,
  FullyBloomed,
  Dead,
}

export enum FlowerType {
  Narcissus, 
}

export interface PetalConfig {
  angleOffset: number; 
  isCurled: boolean;   
  isLayered: boolean; 
  scale: number;       
}

export interface FlowerEntity {
  id: number;
  x: number;
  height: number;
  maxHeight: number;
  
  // Growth Logic
  speedTier: 'slow' | 'medium' | 'fast';
  baseSpeed: number;
  
  swayPhase: number;
  swaySpeed: number;
  
  // Visuals
  colorBase: string;
  colorTip: string;
  
  // 3D Orientation
  rotationZ: number; // Tilt Left/Right (Roll)
  rotationX: number; // Nod Up/Down (Pitch)
  rotationY: number; // Turn Side (Yaw)
  visualScale: number; 
  depth: number;       
  
  petalConfiguration: PetalConfig[];
  
  state: FlowerState;
  bloomProgress: number; // 0 to 1
  bloomTimer: number;    // Frames spent fully bloomed
  type: FlowerType;
}

export interface DebrisEntity {
  id: number;
  x: number;
  y: number;
  // Flight Mechanics
  isHarvested: boolean;
  startX: number;
  startY: number;
  controlX: number; // For bezier curve
  controlY: number;
  targetX: number;
  targetY: number;
  startTime: number;
  flightDuration: number;

  rotation: number;
  rotationSpeed: number;
  
  length: number;
  widthBase: number;
  widthTip: number;
  colorBase: string;
  colorTip: string;
  
  // Inherited Visuals
  bloomProgress: number;
  rotationZ: number;
  rotationX: number;
  rotationY: number;
  visualScale: number;
  petalConfiguration: PetalConfig[];
  curveStrength: number;
}

export interface ParticleEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
  type: 'shard' | 'petal' | 'pollen' | 'scent';
}

export interface FlowerGardenProps {
  onHarvest: () => void;
  isGestureEnabled: boolean;
  isPlaying: boolean;
}
