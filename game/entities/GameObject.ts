import { Container } from 'pixi.js';

export abstract class GameObject {
    public id: string;
    public container: Container;
    public markedForDeletion: boolean = false;

    constructor(id: string) {
        this.id = id;
        this.container = new Container();
    }

    abstract update(dt: number): void;
    
    destroy() {
        this.container.destroy({ children: true });
    }
}
