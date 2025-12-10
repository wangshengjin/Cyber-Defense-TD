import React from 'react';
import { Enemy, Tower, Projectile, Particle, Beam, MAP_WIDTH, MAP_HEIGHT, TowerType } from '../types';
import { Zap, Hexagon, Snowflake, Crosshair } from 'lucide-react';
import { TOWER_STATS } from '../constants';

interface EntityLayerProps {
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  particles: Particle[];
  beams: Beam[];
  selectedTowerId: string | null;
  selectedTowerType: TowerType | null;
  hoverPos: { x: number, y: number } | null;
}

const EntityLayer: React.FC<EntityLayerProps> = ({ 
  enemies, towers, projectiles, particles, beams,
  selectedTowerId, selectedTowerType, hoverPos 
}) => {
  const getPositionStyle = (x: number, y: number) => ({
    left: `${(x / MAP_WIDTH) * 100}%`,
    top: `${(y / MAP_HEIGHT) * 100}%`,
    width: `${(1 / MAP_WIDTH) * 100}%`,
    height: `${(1 / MAP_HEIGHT) * 100}%`,
  });

  const getTowerIcon = (type: TowerType) => {
    switch(type) {
      case TowerType.LASER: return <Zap size={20} className="text-cyan-200" />;
      case TowerType.CANNON: return <Hexagon size={20} className="text-orange-200 fill-orange-500/20" />;
      case TowerType.SLOW: return <Snowflake size={20} className="text-blue-200" />;
      case TowerType.SNIPER: return <Crosshair size={20} className="text-fuchsia-200" />;
    }
  };

  const getTowerColor = (type: TowerType) => {
    switch(type) {
      case TowerType.LASER: return 'bg-cyan-600 border-cyan-400 shadow-[0_0_15px_rgba(8,145,178,0.6)]';
      case TowerType.CANNON: return 'bg-orange-600 border-orange-400 shadow-[0_0_15px_rgba(234,88,12,0.6)]';
      case TowerType.SLOW: return 'bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.6)]';
      case TowerType.SNIPER: return 'bg-fuchsia-600 border-fuchsia-400 shadow-[0_0_15px_rgba(192,38,211,0.6)]';
    }
  };

  // --- Range Indicator Logic ---
  let rangeCircle = null;

  // 1. Existing Tower Selected
  if (selectedTowerId) {
    const tower = towers.find(t => t.id === selectedTowerId);
    if (tower) {
      const range = TOWER_STATS[tower.type].range;
      rangeCircle = { x: tower.x, y: tower.y, range, color: 'border-white/50 bg-white/10' };
    }
  } 
  // 2. Building Placement Hover
  else if (selectedTowerType && hoverPos) {
      const range = TOWER_STATS[selectedTowerType].range;
      rangeCircle = { x: hoverPos.x, y: hoverPos.y, range, color: 'border-green-400/50 bg-green-400/10' };
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
      
      {/* Range Indicator Layer (Bottom) */}
      {rangeCircle && (
         <div 
            className={`absolute rounded-full border border-dashed transition-all duration-75 z-0 ${rangeCircle.color}`}
            style={{
                left: `${(rangeCircle.x / MAP_WIDTH) * 100}%`,
                top: `${(rangeCircle.y / MAP_HEIGHT) * 100}%`,
                width: `${(rangeCircle.range * 2 / MAP_WIDTH) * 100}%`,
                height: `${(rangeCircle.range * 2 / MAP_HEIGHT) * 100}%`,
                transform: 'translate(-50%, -50%)'
            }}
         />
      )}

      {/* Towers */}
      {towers.map(tower => (
        <div
          key={tower.id}
          className={`absolute flex items-center justify-center border-2 rounded-lg transition-transform z-10 ${getTowerColor(tower.type)}`}
          style={{
            ...getPositionStyle(tower.x, tower.y),
            transform: 'scale(0.85)',
          }}
        >
          {getTowerIcon(tower.type)}
          {/* Level indicator */}
           {tower.level > 1 && (
               <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                   {tower.level}
               </div>
           )}
        </div>
      ))}

      {/* Enemies */}
      {enemies.map(enemy => (
        <div
          key={enemy.id}
          className="absolute z-20 flex flex-col items-center justify-center transition-transform"
          style={{
            left: `${(enemy.x / MAP_WIDTH) * 100}%`,
            top: `${(enemy.y / MAP_HEIGHT) * 100}%`,
            width: `${(1 / MAP_WIDTH) * 100}%`,
            height: `${(1 / MAP_HEIGHT) * 100}%`,
            transform: `translate(-50%, -50%) scale(${enemy.type === 'BOSS' ? 1.5 : enemy.type === 'TANK' ? 1.2 : 0.8})`,
          }}
        >
          {/* HP Bar */}
          <div className="w-full h-1.5 bg-gray-700 rounded-full mb-1 overflow-hidden">
            <div 
              className={`h-full transition-all duration-100 ${enemy.frozenFactor < 1 ? 'bg-blue-400' : 'bg-green-500'}`}
              style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
            />
          </div>
          
          {/* Body */}
          <div 
            className="w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center relative"
            style={{ 
              backgroundColor: enemy.frozenFactor < 1 ? '#60a5fa' : (enemy as any).color || '#ef4444',
              borderColor: enemy.frozenFactor < 1 ? '#93c5fd' : 'white'
             }}
          >
             {enemy.type === 'BOSS' && <div className="absolute text-[8px] font-bold text-white">BOSS</div>}
          </div>
        </div>
      ))}

      {/* Projectiles */}
      {projectiles.map(proj => (
        <div
            key={proj.id}
            className="absolute z-30 rounded-full"
            style={{
                left: `${(proj.x / MAP_WIDTH) * 100}%`,
                top: `${(proj.y / MAP_HEIGHT) * 100}%`,
                width: '8px',
                height: '8px',
                backgroundColor: proj.color,
                boxShadow: `0 0 10px ${proj.color}`,
                transform: 'translate(-50%, -50%)'
            }}
        />
      ))}

      {/* Beams (Laser/Sniper) */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
         {beams.map(beam => {
             // Convert coordinates to %
             const x1 = (beam.startX / MAP_WIDTH) * 100;
             const y1 = (beam.startY / MAP_HEIGHT) * 100;
             const x2 = (beam.endX / MAP_WIDTH) * 100;
             const y2 = (beam.endY / MAP_HEIGHT) * 100;
             const opacity = beam.life / beam.maxLife;
             
             return (
                 <line 
                    key={beam.id}
                    x1={`${x1}%`} y1={`${y1}%`}
                    x2={`${x2}%`} y2={`${y2}%`}
                    stroke={beam.color}
                    strokeWidth={beam.width}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 5px ${beam.color})` }}
                 />
             );
         })}
      </svg>

      {/* Particles/Explosions */}
      {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none z-40"
            style={{
                left: `${(p.x / MAP_WIDTH) * 100}%`,
                top: `${(p.y / MAP_HEIGHT) * 100}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                opacity: p.life,
                transform: 'translate(-50%, -50%)',
            }}
          />
      ))}
    </div>
  );
};

export default EntityLayer;