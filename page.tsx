"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, Trophy, Play, Repeat, Star, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// --- Game Component and Logic moved from GravityShiftGame.tsx ---

interface GravityShiftGameProps {
  onGameOver: (score: number) => void;
  setScore: (score: number) => void;
  setCoinsCollected: (coins: number) => void;
}

const PLAYER_SIZE = 30;
const GRAVITY_PULL = 0.9;
const PLAYER_X_POSITION = 100;
const OBSTACLE_WIDTH = 40;
const COIN_RADIUS = 12;
const OBSTACLE_MIN_GAP = 280;
const OBSTACLE_MAX_GAP = 450;
const INITIAL_SPEED = 6;
const SPEED_INCREMENT = 0.0015;
const CAPE_LENGTH = 10;

type CapeSegment = { x: number; y: number; };

type Player = {
  x: number;
  y: number;
  vy: number;
  gravity: number;
  isSwitching: boolean;
  cape: CapeSegment[];
  rotation: number;
};

type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'spike' | 'block';
};

type Coin = {
  x: number;
  y: number;
  radius: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  decay: number;
}

function GravityShiftGame({ onGameOver, setScore, setCoinsCollected }: GravityShiftGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameLoopRef = useRef<number>();
  const dimensions = useRef({ width: 0, height: 0 });
  const isGameOverRef = useRef(false);
  
  const playerRef = useRef<Player>({ x: 0, y: 0, vy: 0, gravity: 1, isSwitching: false, cape: [], rotation: 0 });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const gameSpeedRef = useRef(INITIAL_SPEED);
  const internalScoreRef = useRef(0);
  const distanceTraveledRef = useRef(0);
  const coinsCollectedRef = useRef(0);

  const colors = useRef({
    primary: 'hsl(273 56% 69%)',
    accent: 'hsl(53 76% 66%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    foreground: 'hsl(0 0% 98%)',
    secondary: 'hsl(270 20% 25%)',
  });

  const switchGravity = useCallback(() => {
    const player = playerRef.current;
    if (!player.isSwitching) {
      player.gravity *= -1;
      player.vy = player.gravity * 3;
      player.isSwitching = true;
    }
  }, []);
  
  const createCoinParticles = useCallback((coin: Coin) => {
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        particlesRef.current.push({
            x: coin.x,
            y: coin.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 3 + 1,
            alpha: 1,
            decay: Math.random() * 0.02 + 0.01
        });
    }
  },[]);


  const resetGame = useCallback(() => {
    const { height } = dimensions.current;
    isGameOverRef.current = false;
    playerRef.current = {
      x: PLAYER_X_POSITION,
      y: height - PLAYER_SIZE - 20,
      vy: 0,
      gravity: 1,
      isSwitching: false,
      cape: Array(CAPE_LENGTH).fill({ x: PLAYER_X_POSITION, y: height - PLAYER_SIZE - 20 }),
      rotation: 0,
    };
    obstaclesRef.current = [];
    coinsRef.current = [];
    particlesRef.current = [];
    gameSpeedRef.current = INITIAL_SPEED;
    internalScoreRef.current = 0;
    distanceTraveledRef.current = 0;
    coinsCollectedRef.current = 0;
    setScore(0);
    setCoinsCollected(0);
  }, [setScore, setCoinsCollected]);

  const drawSpike = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, onCeiling: boolean) => {
    const groundY = dimensions.current.height;
    
    ctx.save();
    
    const grad = ctx.createLinearGradient(x, onCeiling ? y : groundY - y, x, onCeiling ? y + height : groundY - y - height);
    grad.addColorStop(0, colors.current.destructive);
    grad.addColorStop(1, `hsl(0 84.2% 40%)`);
    ctx.fillStyle = grad;

    ctx.beginPath();
    if (onCeiling) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.lineTo(x + width / 2, y + height);
    } else {
        ctx.moveTo(x, groundY - y);
        ctx.lineTo(x + width, groundY - y);
        ctx.lineTo(x + width / 2, groundY - (y + height));
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'hsl(0 84.2% 30%)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  };

  const gameLoop = useCallback(() => {
    if (isGameOverRef.current) return;
    const { width, height } = dimensions.current;
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- UPDATE LOGIC ---
    gameSpeedRef.current += SPEED_INCREMENT;
    distanceTraveledRef.current += gameSpeedRef.current;
    
    const newScore = Math.floor(distanceTraveledRef.current / 100) + internalScoreRef.current;
    setScore(newScore);

    const player = playerRef.current;
    const groundY = height - PLAYER_SIZE;
    const ceilingY = 0;

    player.vy += player.gravity * GRAVITY_PULL;
    player.y += player.vy;
    
    if (player.gravity === 1 && player.y >= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.isSwitching = false;
    } else if (player.gravity === -1 && player.y <= ceilingY) {
      player.y = ceilingY;
      player.vy = 0;
      player.isSwitching = false;
    }
    
    // Player rotation animation
    if(player.isSwitching) {
        player.rotation += 0.2 * player.gravity;
    } else {
        // Dampen rotation
        player.rotation *= 0.9;
    }

    // Cape update
    const playerCenterX = player.x + PLAYER_SIZE / 2;
    const playerCenterY = player.y + PLAYER_SIZE / 2;
    let prevCapeSegment = {x: playerCenterX, y: playerCenterY};
    player.cape = player.cape.map((segment, i) => {
        const newSegment = {...segment};
        const dx = prevCapeSegment.x - newSegment.x;
        const dy = prevCapeSegment.y - newSegment.y;
        newSegment.x += dx * 0.5;
        newSegment.y += dy * 0.5;
        prevCapeSegment = newSegment;
        return newSegment;
    })


    obstaclesRef.current.forEach(o => o.x -= gameSpeedRef.current);
    const lastObstacle = obstaclesRef.current[obstaclesRef.current.length - 1];
    
    if (!lastObstacle || lastObstacle.x < width - (OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP))) {
        const onCeiling = Math.random() > 0.5;
        const obstacleType = Math.random() > 0.3 ? 'spike' : 'block';
        const yPos = onCeiling ? 0 : height - OBSTACLE_WIDTH;

        obstaclesRef.current.push({
          x: width,
          y: yPos,
          width: OBSTACLE_WIDTH,
          height: OBSTACLE_WIDTH,
          type: obstacleType,
        });

        if (Math.random() > 0.5) {
            coinsRef.current.push({
                x: width + OBSTACLE_WIDTH + 100,
                y: onCeiling ? 100 : height - 100,
                radius: COIN_RADIUS,
            });
        }
    }
    obstaclesRef.current = obstaclesRef.current.filter(o => o.x + o.width > 0);
    
    coinsRef.current.forEach(c => c.x -= gameSpeedRef.current);
    coinsRef.current = coinsRef.current.filter(c => c.x + c.radius > 0);
    
    particlesRef.current.forEach(p => {
        p.x += p.vx - gameSpeedRef.current;
        p.y += p.vy;
        p.alpha -= p.decay;
    });
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);


    const playerRect = { x: player.x, y: player.y, width: PLAYER_SIZE, height: PLAYER_SIZE };

    for (const obstacle of obstaclesRef.current) {
        let collided = false;
        if (obstacle.type === 'block') {
            const obstacleRect = { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };
            if (playerRect.x < obstacleRect.x + obstacleRect.width &&
                playerRect.x + playerRect.width > obstacleRect.x &&
                playerRect.y < obstacleRect.y + obstacleRect.height &&
                playerRect.y + playerRect.height > obstacleRect.y) {
                collided = true;
            }
        } else { // Spike logic
            const onCeiling = obstacle.y === 0;

             // AABB check first for performance
            const obstacleRect = {
                x: obstacle.x,
                y: onCeiling ? 0 : height - obstacle.height,
                width: obstacle.width,
                height: obstacle.height
            };

            if (playerRect.x < obstacleRect.x + obstacleRect.width &&
                playerRect.x + playerRect.width > obstacleRect.x &&
                playerRect.y < obstacleRect.y + obstacleRect.height &&
                playerRect.y + playerRect.height > obstacleRect.y) {
                
                // More precise check for triangle collision
                const playerCorners = [
                    {x: playerRect.x, y: playerRect.y},
                    {x: playerRect.x + playerRect.width, y: playerRect.y},
                    {x: playerRect.x, y: playerRect.y + playerRect.height},
                    {x: playerRect.x + playerRect.width, y: playerRect.y + playerRect.height},
                ];

                const spikePoints = [
                    { x: obstacle.x, y: onCeiling ? 0 : height },
                    { x: obstacle.x + obstacle.width, y: onCeiling ? 0 : height },
                    { x: obstacle.x + obstacle.width / 2, y: onCeiling ? obstacle.height : height - obstacle.height }
                ];

                for (const corner of playerCorners) {
                    if (isPointInTriangle(corner, spikePoints[0], spikePoints[1], spikePoints[2])) {
                        collided = true;
                        break;
                    }
                }
            }
        }

        if (collided) {
            if (!isGameOverRef.current) {
                isGameOverRef.current = true;
                onGameOver(newScore);
            }
            return;
        }
    }


    let collectedCoinsCount = 0;
    coinsRef.current = coinsRef.current.filter(coin => {
      const dist = Math.sqrt((playerRect.x + playerRect.width / 2 - coin.x)**2 + (playerRect.y + playerRect.height / 2 - coin.y)**2);
      if (dist < playerRect.width / 2 + coin.radius) {
        collectedCoinsCount++;
        createCoinParticles(coin);
        return false;
      }
      return true;
    });

    if (collectedCoinsCount > 0) {
        internalScoreRef.current += collectedCoinsCount * 10;
        coinsCollectedRef.current += collectedCoinsCount;
        setCoinsCollected(coinsCollectedRef.current);
        setScore(Math.floor(distanceTraveledRef.current / 100) + internalScoreRef.current);
    }

    // --- DRAWING LOGIC ---
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = colors.current.secondary;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, width, 5);
    ctx.fillRect(0, height - 5, width, 5);
    ctx.globalAlpha = 1.0;

    // Draw Cape
    if(player.cape.length > 0) {
        ctx.beginPath();
        ctx.moveTo(player.cape[0].x, player.cape[0].y);
        for(let i=1; i < player.cape.length - 2; i++) {
            const xc = (player.cape[i].x + player.cape[i + 1].x) / 2;
            const yc = (player.cape[i].y + player.cape[i + 1].y) / 2;
            ctx.quadraticCurveTo(player.cape[i].x, player.cape[i].y, xc, yc);
        }
        ctx.quadraticCurveTo(player.cape[player.cape.length - 2].x, player.cape[player.cape.length - 2].y, player.cape[player.cape.length - 1].x, player.cape[player.cape.length - 1].y);
        ctx.lineWidth = 4;
        ctx.strokeStyle = colors.current.primary;
        ctx.stroke();
    }


    // Draw Player
    ctx.save();
    ctx.translate(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
    ctx.rotate(player.rotation);
    if (player.gravity === -1) {
        ctx.rotate(Math.PI);
    }
    ctx.fillStyle = colors.current.primary;
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.strokeStyle = colors.current.foreground;
    ctx.lineWidth = 2;
    ctx.strokeRect(-PLAYER_SIZE/2, -PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.restore();

    // Draw Obstacles
    obstaclesRef.current.forEach(o => {
      if (o.type === 'block') {
        const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.height);
        grad.addColorStop(0, colors.current.destructive);
        grad.addColorStop(1, `hsl(0 84.2% 40%)`);
        ctx.fillStyle = grad;
        
        ctx.fillRect(o.x, o.y, o.width, o.height);
        ctx.strokeStyle = 'hsl(0 84.2% 30%)';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x, o.y, o.width, o.height);

      } else {
        drawSpike(ctx, o.x, 0, o.width, o.height, o.y === 0);
      }
    });
    
    // Draw Coins
    ctx.fillStyle = colors.current.accent;
    ctx.strokeStyle = `rgba(255,255,255,0.5)`;
    ctx.lineWidth = 2;
    coinsRef.current.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    
    // Draw Particles
    particlesRef.current.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(53, 76%, 66%, ${p.alpha})`;
        ctx.fill();
    });


    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [onGameOver, setScore, createCoinParticles, setCoinsCollected]);

  const fetchColors = useCallback(() => {
    if (typeof window !== 'undefined') {
        try {
            const computedStyle = getComputedStyle(document.documentElement);
            colors.current = {
                primary: `hsl(${computedStyle.getPropertyValue('--primary').trim()})` || 'hsl(273 56% 69%)',
                accent: `hsl(${computedStyle.getPropertyValue('--accent').trim()})` || 'hsl(53 76% 66%)',
                destructive: `hsl(${computedStyle.getPropertyValue('--destructive').trim()})` || 'hsl(0 84.2% 60.2%)',
                foreground: `hsl(${computedStyle.getPropertyValue('--foreground').trim()})` || 'hsl(0 0% 98%)',
                secondary: `hsl(${computedStyle.getPropertyValue('--secondary').trim()})` || 'hsl(270 20% 25%)',
            }
        } catch (e) {
            console.error("Could not fetch CSS variables for game canvas.", e);
        }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    fetchColors();

    const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const { clientWidth, clientHeight } = parent;
        dimensions.current.width = clientWidth;
        dimensions.current.height = clientHeight;

        const { devicePixelRatio: ratio = 1 } = window;
        canvas.width = clientWidth * ratio;
        canvas.height = clientHeight * ratio;
        canvas.style.width = `${clientWidth}px`;
        canvas.style.height = `${clientHeight}px`;
        
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(ratio, ratio);
        
        resetGame();
    };

    const handleInput = (e: Event) => {
      if (e instanceof KeyboardEvent && e.code !== 'Space') return;
      e.preventDefault();
      if (!isGameOverRef.current) {
        switchGravity();
      }
    };
    
    resizeCanvas();
    
    // Debounce resize
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 100);
    }
    
    window.addEventListener('resize', debouncedResize);
    window.addEventListener('keydown', handleInput);
    canvas.addEventListener('touchstart', handleInput, { passive: false });
    canvas.addEventListener('mousedown', handleInput);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('keydown', handleInput);
      if (canvas) {
        canvas.removeEventListener('touchstart', handleInput);
        canvas.removeEventListener('mousedown', handleInput);
      }
    };
  }, [gameLoop, resetGame, switchGravity, fetchColors]);

  return <canvas ref={canvasRef} className="w-full h-full rounded-lg" />;
}

// Helper function for triangle collision
function sign(p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function isPointInTriangle(pt: {x:number, y:number}, v1: {x:number, y:number}, v2: {x:number, y:number}, v3: {x:number, y:number}) {
    const d1 = sign(pt, v1, v2);
    const d2 = sign(pt, v2, v3);
    const d3 = sign(pt, v3, v1);

    const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(has_neg && has_pos);
}


// --- Main Page Component ---

type GameState = "idle" | "playing" | "gameOver";

export default function Home() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [gameId, setGameId] = useState(1);
  const [isShaking, setIsShaking] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);

  useEffect(() => {
    const savedHighScore = localStorage.getItem("gravityShiftHighScore");
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
    const savedMobileMode = localStorage.getItem("gravityShiftMobileMode");
    if (savedMobileMode) {
      setIsMobileMode(JSON.parse(savedMobileMode));
    }
  }, []);
  
  const handleSetMobileMode = (isMobile: boolean) => {
    setIsMobileMode(isMobile);
    localStorage.setItem("gravityShiftMobileMode", JSON.stringify(isMobile));
  }

  const startGame = useCallback(() => {
    setScore(0);
    setCoinsCollected(0);
    setGameState("playing");
  }, []);

  const handleGameOver = useCallback((currentScore: number) => {
    setFinalScore(currentScore);
    setGameState("gameOver");
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem("gravityShiftHighScore", currentScore.toString());
    }
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  },[highScore]);

  const restartGame = useCallback(() => {
    setGameId(id => id + 1);
    startGame();
  }, [startGame]);
  
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (gameState === 'idle') {
          startGame();
        } else if (gameState === 'gameOver') {
          restartGame();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [gameState, startGame, restartGame]);

  const ScoreDisplay = useCallback(({ isGameOver }: { isGameOver: boolean }) => (
    <div className={`absolute top-4 ${isGameOver ? 'left-1/2 -translate-x-1/2' : 'left-4'} z-10 flex flex-col items-center gap-2 transition-all duration-300`}>
        <div className="flex items-center gap-2 text-accent">
            <Award className="w-8 h-8"/>
            <span className="text-4xl font-bold">{isGameOver ? finalScore : score}</span>
        </div>
        <div className="flex items-center gap-2 text-primary text-lg">
            <Trophy className="w-5 h-5"/>
            <span>High Score: {highScore}</span>
        </div>
    </div>
  ), [score, highScore, finalScore]);

  return (
    <main className={`flex flex-col items-center justify-center min-h-screen bg-background text-foreground font-headline p-4 relative overflow-hidden ${isShaking ? 'animate-screen-shake' : ''}`}>
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
            <h1 className={`${isMobileMode ? 'text-4xl' : 'text-6xl md:text-8xl'} font-black text-secondary/10 select-none whitespace-nowrap`}>NAVPREET SINGH</h1>
        </div>
      
      <div className="z-10 w-full flex items-center justify-center">
        {gameState === "playing" && (
            <div className="absolute top-4 right-4 z-10 flex flex-col items-center gap-2 text-accent">
                <div className="flex items-center gap-2">
                    <Star className="w-8 h-8"/>
                    <span className="text-4xl font-bold">{coinsCollected}</span>
                </div>
            </div>
        )}
        {gameState === "playing" && <ScoreDisplay isGameOver={false} />}

        {gameState === "idle" && (
          <Card className="w-full max-w-md text-center bg-card shadow-lg shadow-primary/20 animate-fade-in-up">
            <CardHeader>
              <CardTitle className="text-5xl font-bold text-primary">Gravity Shift</CardTitle>
              <CardDescription className="text-lg text-foreground/80 pt-2">
                Run. Flip. Survive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="text-left bg-secondary/30 p-4 rounded-lg space-y-2">
                    <h3 className="font-bold text-primary mb-2 text-center text-xl">High Score</h3>
                    <div className="flex items-center justify-center gap-2 text-accent">
                        <Trophy className="w-8 h-8"/>
                        <p className="text-4xl font-bold">{highScore}</p>
                    </div>
                 </div>
              <div className="text-left bg-secondary/30 p-4 rounded-lg space-y-4">
                <div>
                    <h3 className="font-bold text-primary mb-2">How to Play:</h3>
                    <p className="text-foreground/90">- Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">SPACE</kbd> or <span className="font-bold">TAP</span> to switch gravity.</p>
                    <p className="text-foreground/90">- Avoid obstacles and collect coins!</p>
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="mobile-mode" className="flex items-center gap-2 text-primary">
                        <Smartphone />
                        Mobile Mode
                    </Label>
                    <Switch
                        id="mobile-mode"
                        checked={isMobileMode}
                        onCheckedChange={handleSetMobileMode}
                    />
                </div>
              </div>
              <Button onClick={startGame} className="w-full text-lg py-6 bg-primary hover:bg-primary/90">
                <Play className="mr-2"/>
                Start Game
              </Button>
            </CardContent>
          </Card>
        )}

        {gameState === "gameOver" && (
          <Card className="w-full max-w-md text-center bg-card shadow-lg shadow-destructive/20 animate-fade-in-up-game-over">
            <CardHeader>
              <CardTitle className="text-5xl font-bold text-destructive flex items-center justify-center gap-2 animate-pulse-destructive">
                  Game Over
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-left bg-secondary/30 p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                            <h3 className="font-bold text-primary mb-2 text-lg">Score</h3>
                            <p className="text-3xl font-bold text-accent">{finalScore}</p>
                        </div>
                         <div className="text-center">
                            <h3 className="font-bold text-primary mb-2 text-lg">Coins</h3>
                            <p className="text-3xl font-bold text-accent">{coinsCollected}</p>
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-primary mb-2 text-lg">High Score</h3>
                            <p className="text-3xl font-bold text-accent">{highScore}</p>
                        </div>
                    </div>
                 </div>
              <Button onClick={restartGame} className="w-full text-lg py-6 bg-primary hover:bg-primary/90">
                <Repeat className="mr-2"/>
                Play Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      <div className={`absolute transition-opacity duration-300 ${gameState === 'playing' ? 'opacity-100' : 'opacity-0 pointer-events-none'} 
        ${isMobileMode 
          ? 'inset-x-0 top-1/2 -translate-y-1/2 h-[50vh] max-h-[400px] w-full aspect-[2/1]' 
          : 'inset-0 w-full h-full'}`}>
        {gameState === 'playing' && <GravityShiftGame key={gameId} onGameOver={handleGameOver} setScore={setScore} setCoinsCollected={setCoinsCollected} />}
      </div>
    </main>
  );
}
