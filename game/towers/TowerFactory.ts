import { TowerType } from '../../types';
import { BaseTower } from './BaseTower';
import { LaserTower, CannonTower, SlowTower, SniperTower } from './TowerImplementations';

export class TowerFactory {
    public static createTower(type: TowerType, id: string, x: number, y: number): BaseTower {
        switch (type) {
            case TowerType.LASER:
                return new LaserTower(id, x, y);
            case TowerType.CANNON:
                return new CannonTower(id, x, y);
            case TowerType.SLOW:
                return new SlowTower(id, x, y);
            case TowerType.SNIPER:
                return new SniperTower(id, x, y);
            default:
                throw new Error(`Unknown tower type: ${type}`);
        }
    }
}
