import Phaser from 'phaser';
import { CARD_KEYS, GameConfig } from '../config';

/**
 * PreloadScene loads all gameplay assets and shows a progress bar.
 * Game scenes should never load assets themselves so the round starts
 * without hiccups.
 *
 * Texture key naming:
 *   bg           — lobby background
 *   card-back    — face-down card art
 *   card-<id>    — face-up card art (one per CARD_KEYS entry)
 */
export class PreloadScene extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.createProgressBar();

        this.load.image('bg', 'assets/sprites/background-lobby.webp');
        this.load.image('background-win', 'assets/sprites/background-win.webp');
        this.load.image('card-back', 'assets/sprites/card-back.webp');
        for (const key of CARD_KEYS) {
            this.load.image(`card-${key}`, `assets/sprites/card-${key}.webp`);
        }

        this.load.audio('card', 'assets/sounds/card.mp3');
        this.load.audio('complete', 'assets/sounds/complete.mp3');
        this.load.audio('success', 'assets/sounds/success.mp3');
        this.load.audio('theme', 'assets/sounds/theme.mp3');
        this.load.audio('timeout', 'assets/sounds/timeout.mp3');
    }

    create(): void {
        this.scene.start('Game');
    }

    private createProgressBar(): void {
        const { width, height } = this.sys.game.scale.gameSize;
        const barWidth = Math.min(400, width * 0.6);
        const barHeight = 24;
        const x = (width - barWidth) / 2;
        const y = (height - barHeight) / 2;

        const frame = this.add.graphics();
        frame.lineStyle(2, 0xffffff, 1);
        frame.strokeRect(x, y, barWidth, barHeight);

        const fill = this.add.graphics();
        const label = this.add
            .text(width / 2, y - 30, 'Loading...', {
                fontFamily: GameConfig.ui.fontFamily,
                fontStyle: '600',
                fontSize: '20px',
                color: '#ffffff',
            })
            .setOrigin(0.5);

        this.load.on('progress', (value: number) => {
            fill.clear();
            fill.fillStyle(0xffffff, 1);
            fill.fillRect(x + 2, y + 2, (barWidth - 4) * value, barHeight - 4);
        });

        this.load.on('complete', () => {
            frame.destroy();
            fill.destroy();
            label.destroy();
        });
    }
}
