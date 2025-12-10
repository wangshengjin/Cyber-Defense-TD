import React from 'react';
import { PATH_COORDINATES } from '../constants';
import { MAP_WIDTH, MAP_HEIGHT } from '../types';

interface GameMapProps {
  onTileClick: (x: number, y: number) => void;
  hoverX: number | null;
  hoverY: number | null;
  isValidPlacement: boolean;
}

const GameMap: React.FC<GameMapProps> = ({ onTileClick, hoverX, hoverY, isValidPlacement }) => {
  // Create a grid representation
  const grid = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(0));

  // Mark path on grid for visualization
  const isPath = (x: number, y: number): boolean => {
    // Simple check if point is on the segments
    for (let i = 0; i < PATH_COORDINATES.length - 1; i++) {
      const p1 = PATH_COORDINATES[i];
      const p2 = PATH_COORDINATES[i+1];
      
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      // Check if point is on the segment (allowing for some thickness or exact match)
      // Since it's a grid, we want exact matches on integer lines
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        // Check if it's strictly horizontal or vertical segment
        if (p1.x === p2.x && x === p1.x) return true;
        if (p1.y === p2.y && y === p1.y) return true;
      }
    }
    return false;
  };

  return (
    <div 
      className="grid absolute top-0 left-0 w-full h-full z-0"
      style={{
        gridTemplateColumns: `repeat(${MAP_WIDTH}, 1fr)`,
        gridTemplateRows: `repeat(${MAP_HEIGHT}, 1fr)`,
      }}
    >
      {grid.map((row, y) => (
        row.map((_, x) => {
          const path = isPath(x, y);
          const isHover = hoverX === x && hoverY === y;
          
          let bgColor = 'bg-gray-900/50';
          if (path) bgColor = 'bg-slate-800/30 border-slate-700/30';
          else bgColor = 'bg-gray-900/80 border-gray-800/50';

          if (isHover) {
            bgColor = isValidPlacement ? 'bg-green-500/30 cursor-pointer' : 'bg-red-500/30 cursor-not-allowed';
          }

          return (
            <div
              key={`${x}-${y}`}
              onClick={() => onTileClick(x, y)}
              onMouseEnter={() => {}} // Could add hover state logic if needed
              className={`border border-white/5 transition-colors duration-150 ${bgColor} ${path ? 'shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' : ''}`}
            >
                {path && (
                    <div className="w-full h-full flex items-center justify-center opacity-10">
                        <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                    </div>
                )}
            </div>
          );
        })
      ))}
    </div>
  );
};

export default GameMap;