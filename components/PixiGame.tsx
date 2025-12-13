import React, { useEffect, useRef } from 'react';
import { TowerType, SelectedTowerInfo } from '../types';
import { gameEngine } from '../game/GameEngine';

interface GameStats {
  money: number;
  lives: number;
  wave: number;
  isGameOver: boolean;
  isPlaying: boolean;
}

interface PixiGameProps {
  onStatsUpdate: (stats: Partial<GameStats>) => void;
  onSelectionUpdate: (info: SelectedTowerInfo | null) => void;
  gameSpeed: number;
  gameState: GameStats;
  selectedTowerType: TowerType | null;
  onSetSelectedTowerType: (type: TowerType | null) => void;
  onSelectTowerId: (id: string | null) => void;
  selectedTowerId: string | null;
  
  commandRef: React.MutableRefObject<{
      startNextWave: () => void;
      restartGame: () => void;
      upgradeTower: () => void;
      sellTower: () => void;
  }>;
}

const PixiGame: React.FC<PixiGameProps> = ({ 
  onStatsUpdate,
  onSelectionUpdate,
  gameSpeed, 
  selectedTowerType,
  onSetSelectedTowerType,
  onSelectTowerId,
  selectedTowerId,
  commandRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mount/Unmount Logic
  useEffect(() => {
      // We only attach to the existing engine instance
      if (containerRef.current) {
          gameEngine.attach(containerRef.current, {
              onStatsUpdate: (stats) => onStatsUpdate(stats),
              onSelectionUpdate: (info) => onSelectionUpdate(info),
              onTowerSelect: (id) => onSelectTowerId(id),
              onTowerTypeReset: () => onSetSelectedTowerType(null)
          });
      }

      // Clean up listeners when component unmounts
      return () => {
          gameEngine.detach();
      };
  }, []); // Run once on mount

  // Sync React Props -> Game Engine
  useEffect(() => {
      gameEngine.setGameSpeed(gameSpeed);
  }, [gameSpeed]);

  useEffect(() => {
      gameEngine.setPlacementMode(selectedTowerType);
  }, [selectedTowerType]);

  useEffect(() => {
      gameEngine.setSelectedTowerId(selectedTowerId);
  }, [selectedTowerId]);

  // Bind Commands (React -> Game Engine Actions)
  useEffect(() => {
      commandRef.current = {
          startNextWave: () => gameEngine.startNextWave(),
          restartGame: () => gameEngine.restartGame(),
          upgradeTower: () => gameEngine.upgradeTower(),
          sellTower: () => gameEngine.sellTower(),
      };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default PixiGame;