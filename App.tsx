import React, { useState, useRef } from 'react';
import { Play, Pause, FastForward, RefreshCw, Heart, Coins, ShieldAlert, Trash2, ArrowUp, X, Skull } from 'lucide-react';
import { TowerType, GameState, MAP_WIDTH, MAP_HEIGHT, CELL_SIZE, Tower, SelectedTowerInfo } from './types'; // Types shared
import { TOWER_STATS } from './constants';
import PixiGame from './components/PixiGame';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    money: 450,
    lives: 20,
    wave: 1,
    isPlaying: false,
    isGameOver: false,
    gameSpeed: 1,
  });

  // Selection State
  const [selectedTowerType, setSelectedTowerType] = useState<TowerType | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  // New state to hold info passed back from PixiGame
  const [selectedTowerInfo, setSelectedTowerInfo] = useState<SelectedTowerInfo | null>(null);

  // Command Refs to control PixiGame
  const commandRef = useRef({
      startNextWave: () => {},
      restartGame: () => {},
      upgradeTower: () => {},
      sellTower: () => {}
  });

  const handleStatsUpdate = (newStats: Partial<GameState>) => {
      setGameState(prev => ({ ...prev, ...newStats }));
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-900 text-white select-none">
      {/* Header */}
      <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 shadow-md z-50">
        <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                霓虹塔防 (PixiJS)
            </h1>
            <div className="flex items-center space-x-2 text-red-400">
                <Heart size={20} fill="currentColor" />
                <span className="font-mono text-xl">{gameState.lives}</span>
            </div>
            <div className="flex items-center space-x-2 text-yellow-400">
                <Coins size={20} />
                <span className="font-mono text-xl">${gameState.money}</span>
            </div>
            <div className="flex items-center space-x-2 text-blue-300">
                <ShieldAlert size={20} />
                <span className="font-mono text-xl">WAVE {gameState.wave}</span>
            </div>
        </div>

        <div className="flex items-center space-x-4">
             <button 
                onClick={() => setGameState(p => ({...p, gameSpeed: p.gameSpeed === 1 ? 2 : 1}))}
                className={`p-2 rounded hover:bg-gray-700 transition ${gameState.gameSpeed > 1 ? 'text-green-400' : 'text-gray-400'}`}
             >
                 <FastForward size={20} />
             </button>
             <button 
                onClick={() => commandRef.current.startNextWave()}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold shadow-lg"
             >
                 {gameState.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                 <span>{gameState.isPlaying ? '暂停' : '下一波'}</span>
             </button>
             <button 
                onClick={() => commandRef.current.restartGame()}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
             >
                 <RefreshCw size={20} />
             </button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative flex items-center justify-center bg-gray-950 overflow-hidden">
         <div 
            className="relative shadow-2xl border border-gray-800"
            style={{ width: MAP_WIDTH * CELL_SIZE, height: MAP_HEIGHT * CELL_SIZE }}
         >
             <PixiGame 
                gameState={gameState}
                gameSpeed={gameState.gameSpeed}
                onStatsUpdate={handleStatsUpdate}
                selectedTowerType={selectedTowerType}
                selectedTowerId={selectedTowerId}
                onSetSelectedTowerType={setSelectedTowerType}
                onSelectTowerId={(id) => {
                    setSelectedTowerId(id);
                    if (id) setSelectedTowerType(null);
                }}
                onSelectionUpdate={setSelectedTowerInfo} // Hook up the callback
                commandRef={commandRef}
             />

             {/* Game Over Overlay */}
             {gameState.isGameOver && (
                 <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                     <Skull size={64} className="text-red-500 mb-4 animate-bounce" />
                     <h2 className="text-4xl font-bold text-white mb-2">GAME OVER</h2>
                     <button 
                        onClick={() => commandRef.current.restartGame()}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold mt-4"
                     >
                         再试一次
                     </button>
                 </div>
             )}
         </div>
      </div>

      {/* Bottom Control Panel */}
      <div className="h-28 bg-gray-800 border-t border-gray-700 z-50 overflow-hidden relative">
        {selectedTowerId && selectedTowerInfo ? (
            <div className="flex items-center justify-between h-full px-8 bg-slate-800">
                <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded flex items-center justify-center border border-gray-600 ${TOWER_STATS[selectedTowerInfo.type].color}`}>
                        <div className="text-2xl font-bold">Lv.{selectedTowerInfo.level}</div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">{TOWER_STATS[selectedTowerInfo.type].name}</h3>
                        <p className="text-sm text-gray-400">{TOWER_STATS[selectedTowerInfo.type].description}</p>
                    </div>
                </div>

                <div className="flex items-center space-x-6">
                    <button 
                        onClick={() => commandRef.current.upgradeTower()}
                        disabled={gameState.money < selectedTowerInfo.upgradeCost}
                        className={`flex flex-col items-center px-6 py-2 rounded-lg border transition-all ${
                            gameState.money >= selectedTowerInfo.upgradeCost 
                            ? 'border-green-500/50 bg-green-900/20 hover:bg-green-900/40 cursor-pointer' 
                            : 'border-gray-600 bg-gray-800 opacity-50 cursor-not-allowed'
                        }`}
                    >
                        <div className="flex items-center space-x-1 text-green-400 mb-1">
                            <ArrowUp size={18} />
                            <span className="font-bold">UPGRADE (${selectedTowerInfo.upgradeCost})</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => commandRef.current.sellTower()}
                        className="flex flex-col items-center px-6 py-2 rounded-lg border border-red-500/50 bg-red-900/20 hover:bg-red-900/40"
                    >
                        <div className="flex items-center space-x-1 text-red-400 mb-1">
                            <Trash2 size={18} />
                            <span className="font-bold">SELL (${selectedTowerInfo.sellPrice})</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => setSelectedTowerId(null)}
                        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-center h-full space-x-6 p-4">
                {Object.values(TOWER_STATS).map((tower) => {
                    const canAfford = gameState.money >= tower.cost;
                    const isSelected = selectedTowerType === Object.keys(TOWER_STATS).find(key => TOWER_STATS[key as TowerType] === tower);
                    const key = Object.keys(TOWER_STATS).find(k => TOWER_STATS[k as TowerType] === tower) as TowerType;

                    return (
                        <button
                            key={tower.name}
                            onClick={() => { setSelectedTowerType(key); setSelectedTowerId(null); }}
                            disabled={!canAfford}
                            className={`
                                relative group flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 min-w-[100px]
                                ${isSelected ? 'border-yellow-400 bg-gray-700 -translate-y-2 shadow-lg' : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'}
                                ${!canAfford ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            <div className={`w-3 h-3 rounded-full mb-2 ${tower.color}`}></div>
                            <span className="font-bold text-sm text-gray-200">{tower.name}</span>
                            <span className="text-yellow-400 text-xs font-mono">${tower.cost}</span>
                        </button>
                    )
                })}
            </div>
        )}
      </div>
    </div>
  );
}