import Phaser from 'phaser';
import './styles.css';

import { GameConfig } from './config';
import { MFEBridge } from './mfe/bridge';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';

/**
 * Entry point. Builds the MFE bridge first so it can already listen for
 * messages while Phaser bootstraps, then creates the game and exposes the
 * bridge through the registry.
 *
 * Scale strategy: `RESIZE` lets the canvas fill its parent and forwards
 * resize events to the active scene. The scene listens for those events
 * and recomputes the grid for the current viewport — that's how the
 * 4 / 3 / 2 column adaptation works.
 */
const mfeBridge = new MFEBridge({
    mfeId: GameConfig.mfe.id,
    allowedShellOrigins: [...GameConfig.mfe.allowedShellOrigins],
    protocolVersion: GameConfig.mfe.protocolVersion,
});
mfeBridge.init();

const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0a0612',
    // Use linear filtering and DPR-aware rendering for crisp visuals.
    render: {
        antialias: true,
        antialiasGL: true,
        pixelArt: false,
        roundPixels: false,
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GameConfig.width,
        height: GameConfig.height,
    },
    scene: [BootScene, PreloadScene, GameScene],
});

game.registry.set('mfeBridge', mfeBridge);

// Dev-only: expose the game on window so it can be inspected from the
// browser console (Phaser is an ES module, so it isn't global otherwise).
//   const g = window.__GAME__;
//   const s = g.scene.getScene('Game');
//   s.hudCells.moves.value.style.fontSize
if (import.meta.env.DEV) {
    (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;
    (window as unknown as { Phaser: typeof Phaser }).Phaser = Phaser;
}
