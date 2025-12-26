
import React, { useRef, useEffect } from 'react';
import { FlowerEntity, FlowerState, ParticleEntity, FlowerType, DebrisEntity, PetalConfig, FlowerGardenProps } from '../types';
import { COLORS, GAME_SETTINGS, PARTICLE_SETTINGS } from '../constants';

export const FlowerGarden: React.FC<FlowerGardenProps> = ({ onHarvest, isGestureEnabled, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const motionCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  const flowersRef = useRef<FlowerEntity[]>([]);
  const debrisRef = useRef<DebrisEntity[]>([]); 
  const particlesRef = useRef<ParticleEntity[]>([]);
  
  const mouseRef = useRef<{ x: number; y: number; prevX: number; prevY: number }>({ x: -1, y: -1, prevX: -1, prevY: -1 });
  
  // Track visual trails for mouse
  const mouseVisualRef = useRef<{
    x: number,
    y: number,
    life: number,
    isCutting: boolean,
    path: {x: number, y: number}[] 
  } | null>(null);

  const animationFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const isResettingRef = useRef<boolean>(false);
  const gestureActiveRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(isPlaying);
  
  // Track gesture visual: x, y, velocity, isCutting, path history
  const gestureCursorRef = useRef<{
    x: number, 
    y: number, 
    vx: number, 
    vy: number, 
    life: number, 
    isCutting: boolean,
    path: {x: number, y: number}[] 
  } | null>(null);

  // Motion Detection State
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);

  // Sync isPlaying prop to ref for use in animation loop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // --- WEBCAM INIT ---
  useEffect(() => {
    if (isGestureEnabled) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then(stream => {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          gestureActiveRef.current = true;
        })
        .catch(err => {
          console.error("Camera access denied or error:", err);
          gestureActiveRef.current = false;
        });
    } else {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      gestureActiveRef.current = false;
      prevFrameDataRef.current = null;
      gestureCursorRef.current = null;
    }
  }, [isGestureEnabled]);

  const processMotion = (screenWidth: number, screenHeight: number) => {
    if (!gestureActiveRef.current || !videoRef.current || videoRef.current.readyState !== 4) return;
    
    const motionCtx = motionCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!motionCtx) return;

    const w = 64; 
    const h = 48;
    if (motionCanvasRef.current.width !== w) {
      motionCanvasRef.current.width = w;
      motionCanvasRef.current.height = h;
    }

    motionCtx.save();
    motionCtx.scale(-1, 1);
    motionCtx.drawImage(videoRef.current, -w, 0, w, h);
    motionCtx.restore();

    const frame = motionCtx.getImageData(0, 0, w, h);
    const data = frame.data;
    const len = data.length;

    if (!prevFrameDataRef.current) {
        prevFrameDataRef.current = new Uint8ClampedArray(data);
        return;
    }

    const prevData = prevFrameDataRef.current;
    
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    // Increased threshold further to 60 to aggressively ignore background noise/flicker
    const threshold = 60; 
    
    // 1. Detect Motion Centroid
    for (let i = 0; i < len; i += 4 * 2) { 
        const rDiff = Math.abs(data[i] - prevData[i]);
        const gDiff = Math.abs(data[i+1] - prevData[i+1]);
        const bDiff = Math.abs(data[i+2] - prevData[i+2]);
        
        if (rDiff + gDiff + bDiff > threshold * 3) {
            const pixelIndex = i / 4;
            const x = pixelIndex % w;
            const y = Math.floor(pixelIndex / w);
            
            sumX += x;
            sumY += y;
            count++;
        }
    }

    prevFrameDataRef.current.set(data);

    if (count > 5) { // Minimum noise threshold
        const rawX = (sumX / count) / w * screenWidth;
        const rawY = (sumY / count) / h * screenHeight;

        let prevX = rawX;
        let prevY = rawY;
        let path: {x:number, y:number}[] = [];

        if (gestureCursorRef.current) {
            // MAXIMAL SMOOTHING (0.94): Creates a very heavy, floaty feel that ignores almost all jitter
            const smoothing = 0.94; 
            prevX = gestureCursorRef.current.x;
            prevY = gestureCursorRef.current.y;
            path = [...gestureCursorRef.current.path];
            
            const currX = prevX * smoothing + rawX * (1 - smoothing);
            const currY = prevY * smoothing + rawY * (1 - smoothing);
            
            // Calculate Velocity
            const vx = currX - prevX;
            const vy = currY - prevY;
            const speed = Math.sqrt(vx*vx + vy*vy);

            // Lower threshold again because high smoothing dampens speed significantly
            const CUT_SPEED_THRESHOLD = 1.5; 
            const isCutting = speed > CUT_SPEED_THRESHOLD;

            // SPATIAL DECIMATION: Only record points if moved significantly (25px).
            // This forces the bezier curves to be drawn over long distances, ensuring smoothness.
            const lastPathPoint = path.length > 0 ? path[path.length - 1] : {x: currX, y: currY};
            const distFromLast = Math.hypot(currX - lastPathPoint.x, currY - lastPathPoint.y);
            
            if (distFromLast > 25) {
                path.push({x: currX, y: currY});
                if (path.length > 20) path.shift();
            } else if (path.length === 0) {
                 path.push({x: currX, y: currY});
            }

            gestureCursorRef.current = { x: currX, y: currY, vx, vy, life: 10, isCutting, path };

            if (isCutting) {
                checkSwipe(prevX, prevY, currX, currY, screenWidth, screenHeight);
            }

        } else {
            // Initial detection
            path.push({x: rawX, y: rawY});
            gestureCursorRef.current = { x: rawX, y: rawY, vx: 0, vy: 0, life: 10, isCutting: false, path };
        }
    } else {
      // No motion detected -> Fade out cursor
      if (gestureCursorRef.current) {
          gestureCursorRef.current.life--;
          gestureCursorRef.current.isCutting = false;
          if (gestureCursorRef.current.life <= 0) {
              gestureCursorRef.current = null;
          }
      }
    }
  };

  const initFlowers = (width: number, height: number) => {
    const flowers: FlowerEntity[] = [];
    const count = GAME_SETTINGS.flowerCount;
    const usableWidth = width;
    const baseSpacing = usableWidth / count;
    
    for (let i = 0; i < count; i++) {
      const stagger = (Math.random() - 0.5) * (baseSpacing * 0.8);
      let x = (i * baseSpacing) + (baseSpacing / 2) + stagger;
      x = Math.max(5, Math.min(width - 5, x));
      flowers.push(createFlower(x, height, i));
    }

    flowers.sort((a, b) => a.depth - b.depth);
    return flowers;
  };

  const createFlower = (x: number, screenHeight: number, id: number): FlowerEntity => {
    const rand = Math.random();
    let speedTier: 'slow' | 'medium' | 'fast' = 'medium';
    let baseSpeed = 0.5; 
    
    if (rand < 0.3) {
      speedTier = 'slow';
      baseSpeed = 0.5;
    } else if (rand > 0.7) {
      speedTier = 'fast';
      baseSpeed = 1.5;
    } else {
      speedTier = 'medium';
      baseSpeed = 1.0;
    }
    baseSpeed += (Math.random() - 0.5) * 0.4;

    const colorPair = COLORS.stemPalette[Math.floor(Math.random() * COLORS.stemPalette.length)];
    
    const tiltDir = Math.random() > 0.5 ? 1 : -1;
    const rotationZ = (tiltDir * (5 + Math.random() * 5)) * (Math.PI / 180);
    const nodDir = Math.random() > 0.5 ? 1 : -1;
    const rotationX = (nodDir * (10 + Math.random() * 10)) * (Math.PI / 180);
    const turnDir = Math.random() > 0.5 ? 1 : -1;
    const rotationY = (turnDir * (10 + Math.random() * 10)) * (Math.PI / 180);

    // Reduced by ~20% (originally 0.85 + rand*0.3)
    const visualScale = 0.68 + Math.random() * 0.24; 
    const depth = Math.random();

    const petalConfiguration: PetalConfig[] = [];
    for(let p=0; p<6; p++) {
        const isCurled = Math.random() > 0.5;
        petalConfiguration.push({
            angleOffset: (Math.random() - 0.5) * 0.2, 
            isCurled: isCurled, 
            isLayered: p % 2 !== 0, 
            scale: 0.9 + Math.random() * 0.2 
        });
    }

    const maxHeight = screenHeight * (0.85 + Math.random() * 0.15);

    return {
      id,
      x,
      height: 0,
      maxHeight,
      speedTier,
      baseSpeed,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.01 + Math.random() * 0.015,
      colorBase: colorPair.base,
      colorTip: colorPair.tip,
      rotationZ,
      rotationX,
      rotationY,
      visualScale,
      depth,
      petalConfiguration,
      state: FlowerState.Growing,
      bloomProgress: 0,
      bloomTimer: 0,
      type: FlowerType.Narcissus,
    };
  };

  const createExplosion = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      const size = Math.random() * 2 + 1; 

      particlesRef.current.push({
        id: Math.random(),
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        color, 
        size,
        type: 'shard'
      });
    }
  };

  const createScentEmission = (screenWidth: number, stemColor: string) => {
      // Emit from Top Right (Score Module)
      const count = 50 + Math.floor(Math.random() * 20);
      
      for(let i=0; i<count; i++) {
          const originX = (screenWidth - 100) + (Math.random() * 60 - 30); 
          const originY = 80 + (Math.random() * 60 - 30);
          
          const angle = Math.PI + (Math.random() * 1.5 - 0.75); // cone pointing left
          const speed = 4 + Math.random() * 8; // Fast
          
          // Determine color composition
          const rand = Math.random();
          let pColor = '#FFFFFF';
          if (rand < 0.2) {
             pColor = stemColor; 
          } else if (rand < 0.4) {
             pColor = COLORS.coreGradientStart; 
          } else {
             pColor = '#FFFFFF'; 
          }

          particlesRef.current.push({
              id: Math.random(),
              x: originX,
              y: originY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed + (Math.random() * 2 - 1), 
              life: 1.0,
              decay: 0.003 + Math.random() * 0.003, 
              color: pColor, 
              size: 1 + Math.random() * 3,
              type: 'scent'
          });
      }
  }

  // --- DRAWING: NARCISSUS HEAD ---

  const drawNarcissusHead = (
    ctx: CanvasRenderingContext2D, 
    progress: number, 
    rotX: number, 
    rotY: number, 
    configs: PetalConfig[],
    stemTipColor: string // Passed from flower.colorTip
  ) => {
    if (progress <= 0.1) {
        // Draw Bud
        // INCREASED SIZE BY 50%:
        // Old: budW = 7, budH = 18
        // New: budW = 10.5, budH = 27
        const budW = 10.5; 
        const budH = 27; 

        // Gradient logic update:
        // Use a Top-Down gradient to ensure the bottom color matches the stem tip exactly.
        const grad = ctx.createLinearGradient(0, -budH, 0, budH);
        grad.addColorStop(0, '#f1fcd4');          // Top: Pale Highlight
        grad.addColorStop(0.4, COLORS.budColor);  // Middle: The tender bud green
        grad.addColorStop(1, stemTipColor);       // Bottom: Matches Stem Tip (Seamless)
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        // Organic tapered bud shape (coordinates relative to budW/budH)
        ctx.moveTo(0, -budH);
        ctx.bezierCurveTo(budW * 1.3, -budH * 0.2, budW, budH * 0.8, 0, budH);
        ctx.bezierCurveTo(-budW, budH * 0.8, -budW * 1.3, -budH * 0.2, 0, -budH);
        ctx.fill();

        // Vertical Center Line Decoration for "texture"
        ctx.strokeStyle = COLORS.budLineColor; 
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -budH * 0.9);
        ctx.quadraticCurveTo(budW * 0.1, 0, 0, budH * 0.85);
        ctx.stroke();

        return;
    }

    const scaleX = Math.cos(rotY * 0.3); 
    const scaleY = 0.6 + (Math.cos(rotX * 0.3) * 0.2); 
    ctx.scale(scaleX, scaleY);
    const openFactor = Math.min(1, Math.max(0, (progress - 0.1) / 0.8));
    const easeBackOut = (t: number) => { const s = 1.2; return --t * t * ((s + 1) * t + s) + 1; };
    const animFactor = easeBackOut(openFactor);
    const petalCount = 6;
    const angleStep = (Math.PI * 2) / petalCount;
    const sortedIndices = configs.map((_, i) => i).sort((a, b) => {
        const angA = a * angleStep;
        const angB = b * angleStep;
        return Math.sin(angA) - Math.sin(angB);
    });

    // Petal Gradient - Clean White
    const pGrad = ctx.createLinearGradient(0, 0, 0, -50);
    pGrad.addColorStop(0, COLORS.petalGradientEnd);
    pGrad.addColorStop(1, COLORS.petalGradientStart);

    sortedIndices.forEach((originalIndex) => {
        const cfg = configs[originalIndex];
        ctx.save();
        const baseAngle = originalIndex * angleStep;
        ctx.rotate(baseAngle);
        const spread = animFactor * 16;
        ctx.translate(0, -spread); 
        const currentScale = (0.4 + 0.6 * animFactor) * cfg.scale;
        ctx.scale(currentScale, currentScale);
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-18, -15, -22, -40, 0, -55); 
        ctx.bezierCurveTo(22, -40, 18, -15, 0, 0);   
        ctx.fill();
        // Removed heavy stroke, just subtle white/opacity for definition
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
    });

    if (openFactor > 0.1) {
        const cupSize = 14 * animFactor;
        const cupHeight = 10 * animFactor;
        ctx.save();
        ctx.translate(0, -2);
        
        // New Lemon Yellow Fluorescent Core
        const cupGrad = ctx.createRadialGradient(0, -2, 0, 0, 0, cupSize);
        cupGrad.addColorStop(0, COLORS.coreGradientEnd); 
        cupGrad.addColorStop(1, COLORS.coreGradientStart); 
        
        ctx.fillStyle = cupGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, cupSize, cupHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Very pale yellow-green center (instead of dark green)
        ctx.fillStyle = COLORS.coreCenterColor; 
        ctx.beginPath();
        ctx.ellipse(0, 0, cupSize * 0.35, cupHeight * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = COLORS.stamenColor;
        for(let k=0; k<3; k++) {
             const a = (k / 3) * Math.PI * 2;
             const r = cupSize * 0.45;
             ctx.beginPath();
             ctx.arc(Math.cos(a)*r, Math.sin(a)*r*0.6, 1.5, 0, Math.PI*2);
             ctx.fill();
        }
        ctx.restore();
    }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, COLORS.bgTop); 
    gradient.addColorStop(1, COLORS.bgBottom); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  // Helper to generate smooth curve points from sparse path
  const getSpinePoints = (rawPath: {x: number, y: number}[]) => {
      if (rawPath.length < 2) return rawPath;
      
      const spine: {x: number, y: number}[] = [];
      spine.push(rawPath[0]); // Start point

      for (let i = 1; i < rawPath.length - 1; i++) {
          const p0 = (i === 1) ? rawPath[0] : { 
              x: (rawPath[i-1].x + rawPath[i].x)/2, 
              y: (rawPath[i-1].y + rawPath[i].y)/2 
          };
          const p1 = rawPath[i];
          const p2 = { 
              x: (rawPath[i].x + rawPath[i+1].x)/2, 
              y: (rawPath[i].y + rawPath[i+1].y)/2 
          };

          const dist = Math.hypot(p2.x - p0.x, p2.y - p0.y);
          const steps = Math.max(2, Math.ceil(dist / 5)); // Resolution ~5px

          for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const it = 1 - t;
              // Quadratic Bezier
              const x = (it*it * p0.x) + (2*it*t * p1.x) + (t*t * p2.x);
              const y = (it*it * p0.y) + (2*it*t * p1.y) + (t*t * p2.y);
              spine.push({x, y});
          }
      }

      // Final segment to actual last point
      if (rawPath.length > 1) {
          const lastIndex = rawPath.length - 1;
          const pLast = rawPath[lastIndex];
          const pPrev = (spine.length > 0) ? spine[spine.length-1] : rawPath[lastIndex-1];
          
          // Interpolate to the very end
          const dist = Math.hypot(pLast.x - pPrev.x, pLast.y - pPrev.y);
          const steps = Math.max(2, Math.ceil(dist / 5));
          for(let s=1; s<=steps; s++) {
             const t = s/steps;
             spine.push({
                 x: pPrev.x + (pLast.x - pPrev.x)*t,
                 y: pPrev.y + (pLast.y - pPrev.y)*t
             });
          }
      }
      
      return spine;
  };

  const drawCursorTrail = (ctx: CanvasRenderingContext2D, cursor: { x: number, y: number, isCutting: boolean, path: {x: number, y: number}[], life: number } | null) => {
      if (!cursor || cursor.life <= 0 || cursor.path.length < 2) return;
      const { x, y, isCutting, path } = cursor;
      
      ctx.save();
      // Fade out based on life
      const alphaMod = Math.min(1, cursor.life / 5);
      
      if (isCutting) {
        const spine = getSpinePoints(path);
        
        if (spine.length > 1) {
            const leftPts: {x: number, y: number}[] = [];
            const rightPts: {x: number, y: number}[] = [];
            
            const maxW = 3.0; // Changed from 8.0 to 3.0 for a sharper blade
            const minW = 0.5;

            for (let i = 0; i < spine.length; i++) {
                const current = spine[i];
                const prev = (i > 0) ? spine[i-1] : spine[0];
                const next = (i < spine.length - 1) ? spine[i+1] : spine[spine.length-1];
                
                let dx = next.x - prev.x;
                let dy = next.y - prev.y;
                if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
                
                const len = Math.sqrt(dx*dx + dy*dy);
                const nx = -dy / len; 
                const ny = dx / len;  
                
                const t = i / (spine.length - 1);
                // Width: Thin tail -> Thick head
                const w = minW + (maxW - minW) * Math.pow(t, 2); // Squared for sharper taper at tail
                
                leftPts.push({ x: current.x + nx * w, y: current.y + ny * w });
                rightPts.push({ x: current.x - nx * w, y: current.y - ny * w });
            }
            
            ctx.beginPath();
            ctx.moveTo(leftPts[0].x, leftPts[0].y);
            for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
            ctx.lineTo(rightPts[rightPts.length - 1].x, rightPts[rightPts.length - 1].y);
            for (let i = rightPts.length - 2; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
            ctx.closePath();
            
            const head = spine[spine.length-1];
            const tail = spine[0];
            const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
            
            // Opacity Gradient: Weak tail -> Strong head
            grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
            grad.addColorStop(1, `rgba(255, 255, 255, ${0.9 * alphaMod})`);
            
            ctx.fillStyle = grad;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgba(255, 255, 255, ${0.5 * alphaMod})`;
            ctx.fill();
        }

        // Tip Glow (Head)
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(255, 255, 255, ${0.8 * alphaMod})`;
        ctx.fillStyle = `rgba(255, 255, 255, ${1.0 * alphaMod})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2); // Slightly smaller tip radius
        ctx.fill();

      } else {
        // Halo code for non-cutting state (rarely used for mouse now as isCutting is true)
        const grad = ctx.createRadialGradient(x, y, 5, x, y, 40);
        grad.addColorStop(0, `rgba(255, 255, 255, ${0.15 * alphaMod})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * alphaMod})`;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
  };

  const drawFlower = (ctx: CanvasRenderingContext2D, flower: FlowerEntity, screenHeight: number) => {
    if (flower.height <= 0) return;

    // Even if paused, we want to draw them. But sway depends on time.
    // When paused, timeRef doesn't update, so sway freezes correctly.
    const swayValue = Math.sin(timeRef.current * flower.swaySpeed + flower.swayPhase) * GAME_SETTINGS.swayAmplitude;
    const currentSway = swayValue * (flower.height / screenHeight);
    
    const rootX = flower.x;
    const rootY = screenHeight;
    const topX = flower.x + currentSway;
    const topY = screenHeight - flower.height;
    
    const cpX = rootX + (currentSway * 0.5); 
    const cpY = rootY - (flower.height * 0.5);

    // Stem
    const steps = 10;
    ctx.beginPath();
    const leftPoints: [number, number][] = [];
    const rightPoints: [number, number][] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const it = 1 - t;
      const bx = it * it * rootX + 2 * it * t * cpX + t * t * topX;
      const by = it * it * rootY + 2 * it * t * cpY + t * t * topY;
      
      const tx = 2 * (1 - t) * (cpX - rootX) + 2 * t * (topX - cpX);
      const ty = 2 * (1 - t) * (cpY - rootY) + 2 * t * (topY - cpY);
      const len = Math.sqrt(tx*tx + ty*ty);
      const nx = -ty / len;
      const ny = tx / len;
      
      const currentWidth = GAME_SETTINGS.stemWidthBase - (GAME_SETTINGS.stemWidthBase - GAME_SETTINGS.stemWidthTip) * t;
      const halfW = currentWidth / 2;
      leftPoints.push([bx + nx * halfW, by + ny * halfW]);
      rightPoints.push([bx - nx * halfW, by - ny * halfW]);
    }
    ctx.moveTo(leftPoints[0][0], leftPoints[0][1]);
    for (let i = 1; i < leftPoints.length; i++) ctx.lineTo(leftPoints[i][0], leftPoints[i][1]);
    for (let i = rightPoints.length - 1; i >= 0; i--) ctx.lineTo(rightPoints[i][0], rightPoints[i][1]);
    ctx.closePath();

    const stemGrad = ctx.createLinearGradient(rootX, rootY, topX, topY);
    stemGrad.addColorStop(0, flower.colorBase);
    stemGrad.addColorStop(1, flower.colorTip);
    ctx.fillStyle = stemGrad;
    ctx.fill();
    
    ctx.save();
    ctx.translate(topX, topY);
    ctx.rotate((currentSway * 0.03) + flower.rotationZ); 
    
    // Draw the head (bud or flower)
    ctx.scale(flower.visualScale, flower.visualScale);
    // PASS flower.colorTip to ensure bud matches stem tip
    drawNarcissusHead(ctx, flower.bloomProgress, flower.rotationX, flower.rotationY, flower.petalConfiguration, flower.colorTip);
    ctx.restore();
  };

  const drawDebris = (ctx: CanvasRenderingContext2D, d: DebrisEntity) => {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);

    const p0 = { x: 0, y: 0 };
    const p1 = { x: 0, y: -d.length * 0.5 };
    const p2 = { x: d.curveStrength, y: -d.length };

    const steps = 8;
    ctx.beginPath();
    const leftPoints: [number, number][] = [];
    const rightPoints: [number, number][] = [];

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const it = 1 - t;
        const bx = it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x;
        const by = it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y;
        
        const tx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
        const ty = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
        
        const len = Math.sqrt(tx*tx + ty*ty);
        const nx = -ty / len;
        const ny = tx / len;
        
        const currentWidth = d.widthBase - (d.widthBase - d.widthTip) * t;
        const halfW = currentWidth / 2;
        leftPoints.push([bx + nx * halfW, by + ny * halfW]);
        rightPoints.push([bx - nx * halfW, by - ny * halfW]);
    }

    ctx.moveTo(leftPoints[0][0], leftPoints[0][1]);
    for (let i = 1; i < leftPoints.length; i++) ctx.lineTo(leftPoints[i][0], leftPoints[i][1]);
    for (let i = rightPoints.length - 1; i >= 0; i--) ctx.lineTo(rightPoints[i][0], rightPoints[i][1]);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, -d.length);
    grad.addColorStop(0, d.colorBase);
    grad.addColorStop(1, d.colorTip);
    ctx.fillStyle = grad;
    ctx.fill();

    const tx = 2 * (p2.x - p1.x);
    const ty = 2 * (p2.y - p1.y);
    const tipRotation = Math.atan2(ty, tx) + Math.PI / 2;

    ctx.translate(p2.x, p2.y);
    ctx.rotate(tipRotation + d.rotationZ); 
    ctx.scale(d.visualScale, d.visualScale);
    // PASS d.colorTip to ensure bud matches stem tip on debris
    drawNarcissusHead(ctx, d.bloomProgress, d.rotationX, d.rotationY, d.petalConfiguration, d.colorTip);
    ctx.restore();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      
      if (p.type === 'scent') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI*2);
          ctx.fill();
      } else {
          ctx.rotate(p.life * 5 + p.id * 10);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size, p.size);
          ctx.lineTo(-p.size, p.size * 0.5);
          ctx.fill();
      }
      ctx.restore();
    });
  };

  const updatePhysics = (width: number, height: number) => {
    timeRef.current += 1;
    const now = performance.now();

    // Webcam Motion
    processMotion(width, height);

    // Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx; p.y += p.vy; 
      
      if (p.type === 'scent') {
          p.vx *= 0.99; 
          p.vy *= 0.99;
      } else {
          p.vx *= 0.9;
          p.vy *= 0.9;
      }
      
      p.life -= p.decay;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }
    
    // Debris
    for (let i = debrisRef.current.length - 1; i >= 0; i--) {
      const d = debrisRef.current[i];
      const elapsed = now - d.startTime;
      const t = Math.min(1, elapsed / d.flightDuration);
      const it = 1 - t;
      d.x = it * it * d.startX + 2 * it * t * d.controlX + t * t * d.targetX;
      d.y = it * it * d.startY + 2 * it * t * d.controlY + t * t * d.targetY;
      
      if (t >= 1) {
          onHarvest();
          createScentEmission(width, d.colorTip); 
          debrisRef.current.splice(i, 1);
      }
    }

    if (isResettingRef.current) return;

    flowersRef.current.forEach(flower => {
      if (flower.state !== FlowerState.Dead) {
        if (flower.height < flower.maxHeight) {
           const fluctuation = (Math.sin(timeRef.current * 0.1 + flower.id) * 0.2);
           const currentSpeed = Math.max(0.1, flower.baseSpeed + fluctuation);
           flower.height += currentSpeed;
        } else {
           flower.bloomTimer++;
           const waitTime = 120; 
           
           if (flower.bloomTimer > waitTime) {
               createExplosion(flower.x + (Math.random()*10 - 5), height - flower.height, flower.colorTip, 15);
               createScentEmission(width, flower.colorTip); 
               const newFlower = createFlower(flower.x, height, flower.id);
               Object.assign(flower, newFlower);
           }
        }
        
        const pct = flower.height / flower.maxHeight;
        let bloomP = 0;
        if (pct > 0.3) {
            bloomP = (pct - 0.3) / 0.6; 
        }
        flower.bloomProgress = Math.max(0, Math.min(1, bloomP));
      }
    });
  };

  const checkSwipe = (prevX: number, prevY: number, currX: number, currY: number, screenWidth: number, screenHeight: number) => {
      // Line Segment Intersection check for precision
      flowersRef.current.forEach(flower => {
        if (flower.height <= 20) return; 
        
        const swayAmount = Math.sin(timeRef.current * flower.swaySpeed + flower.swayPhase) * (flower.height / screenHeight) * GAME_SETTINGS.swayAmplitude;
        const stemBaseX = flower.x;
        const stemTopY = screenHeight - flower.height;
        const stemTopX = stemBaseX + swayAmount;
        
        // Simplified stem as a line segment
        const stemX = (stemBaseX + stemTopX) / 2; // approximation
        
        // Check if swipe line crosses stem X at a relevant Y
        // We look for intersection between (prevX,prevY)-(currX,currY) and vertical stem area
        
        // Bounding box check first
        const minSwipeY = Math.min(prevY, currY);
        const maxSwipeY = Math.max(prevY, currY);
        
        if (maxSwipeY < stemTopY || minSwipeY > screenHeight) return;

        const minSwipeX = Math.min(prevX, currX);
        const maxSwipeX = Math.max(prevX, currX);

        // Does the swipe cross the stem's horizontal area?
        // Let's interpolate exactly where the intersection happens
        if (minSwipeX < stemX + 15 && maxSwipeX > stemX - 15) {
             // Calculate precise cut Y
             // Map t on swipe line where x = stemX
             // Simple version: just use mid point of swipe for cut height
             const cutY = (prevY + currY) / 2;
             
             if (cutY > stemTopY && cutY < screenHeight) {
                 cutFlower(flower, cutY, screenWidth, screenHeight);
             }
        }
      });
  }

  const checkInteractions = (screenWidth: number, screenHeight: number) => {
    if (isResettingRef.current) return;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const px = mouseRef.current.prevX;

    if (mx < 0 || px < 0) return;

    flowersRef.current.forEach(flower => {
        if (flower.height <= 20) return; 
        const swayAmount = Math.sin(timeRef.current * flower.swaySpeed + flower.swayPhase) * (flower.height / screenHeight) * GAME_SETTINGS.swayAmplitude;
        const flowerBaseX = flower.x;
        const stemHeight = flower.height;
        const flowerTopY = screenHeight - stemHeight;
        
        if (my < flowerTopY || my > screenHeight) return;

        const t = (screenHeight - my) / stemHeight; 
        const stemAtMouseX = flowerBaseX + (swayAmount * t); 
        
        const crossed = (px < stemAtMouseX + 15 && mx > stemAtMouseX - 15) || (px > stemAtMouseX - 15 && mx < stemAtMouseX + 15);
        
        if (crossed) {
            cutFlower(flower, my, screenWidth, screenHeight);
        }
    });
  };

  const cutFlower = (flower: FlowerEntity, cutY: number, screenWidth: number, screenHeight: number) => {
        const cutHeight = screenHeight - cutY; 
        const fallingLength = flower.height - cutHeight;
        const targetX = screenWidth - 100;
        const targetY = 80;
        const t = (screenHeight - cutY) / flower.height;
        const widthAtCut = GAME_SETTINGS.stemWidthBase - (GAME_SETTINGS.stemWidthBase - GAME_SETTINGS.stemWidthTip) * t;

        // Current sway position at cut
        const swayAmount = Math.sin(timeRef.current * flower.swaySpeed + flower.swayPhase) * (flower.height / screenHeight) * GAME_SETTINGS.swayAmplitude;
        const stemAtCutX = flower.x + swayAmount * t;

        const curveDir = Math.random() > 0.5 ? 1 : -1;
        const curveS = fallingLength * (0.2 + Math.random() * 0.1) * curveDir;

        debrisRef.current.push({
          id: Math.random(),
          x: stemAtCutX,
          y: cutY,
          isHarvested: true,
          startX: stemAtCutX,
          startY: cutY,
          controlX: (stemAtCutX + targetX) / 2 + (Math.random() * 50 - 25),
          controlY: cutY - (Math.random() * 200 + 100), 
          targetX,
          targetY,
          startTime: performance.now(),
          flightDuration: 1000 + Math.random() * 300, 

          rotation: 0, 
          rotationSpeed: 0, 
          length: fallingLength,
          widthBase: widthAtCut,
          widthTip: GAME_SETTINGS.stemWidthTip,
          colorBase: flower.colorBase,
          colorTip: flower.colorTip,
          bloomProgress: flower.bloomProgress,
          rotationZ: flower.rotationZ,
          rotationX: flower.rotationX,
          rotationY: flower.rotationY,
          visualScale: flower.visualScale,
          petalConfiguration: flower.petalConfiguration,
          curveStrength: curveS
        });

        createExplosion(stemAtCutX, cutY, COLORS.stemPalette[0].tip, PARTICLE_SETTINGS.explodeCount);

        flower.height = 0; 
        flower.bloomProgress = 0;
        flower.bloomTimer = 0;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      flowersRef.current = initFlowers(canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const loop = () => {
      if (isPlayingRef.current) {
        updatePhysics(canvas.width, canvas.height);
        checkInteractions(canvas.width, canvas.height);
      }
      
      drawBackground(ctx, canvas.width, canvas.height);
      flowersRef.current.forEach(f => drawFlower(ctx, f, canvas.height));
      debrisRef.current.forEach(d => drawDebris(ctx, d));
      drawParticles(ctx);
      
      // Draw trails
      drawCursorTrail(ctx, gestureCursorRef.current);
      drawCursorTrail(ctx, mouseVisualRef.current);

      // Decay visual for mouse
      if (mouseVisualRef.current) {
        mouseVisualRef.current.life -= 1;
        if (mouseVisualRef.current.life <= 0) {
            mouseVisualRef.current = null;
        }
      }
      
      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      mouseRef.current.x = x;
      mouseRef.current.y = y;

      // Update Mouse Visual
      if (!mouseVisualRef.current) {
         mouseVisualRef.current = { x, y, life: 10, isCutting: true, path: [{x, y}] };
      } else {
         const mv = mouseVisualRef.current;
         mv.x = x;
         mv.y = y;
         mv.life = 10;
         mv.path.push({x, y});
         if (mv.path.length > 20) mv.path.shift();
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && e.touches.length > 0) {
          const x = e.touches[0].clientX - rect.left;
          const y = e.touches[0].clientY - rect.top;
          
          mouseRef.current.x = x;
          mouseRef.current.y = y;
          
          // Update Touch Visual
          if (!mouseVisualRef.current) {
             mouseVisualRef.current = { x, y, life: 10, isCutting: true, path: [{x, y}] };
          } else {
             const mv = mouseVisualRef.current;
             mv.x = x;
             mv.y = y;
             mv.life = 10;
             mv.path.push({x, y});
             if (mv.path.length > 20) mv.path.shift();
          }
      }
  }

  return (
    <div ref={containerRef} className="w-full h-full cursor-crosshair relative">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
      />
      {/* Hidden elements for processing */}
      <canvas ref={motionCanvasRef} className="hidden" />
    </div>
  );
};
