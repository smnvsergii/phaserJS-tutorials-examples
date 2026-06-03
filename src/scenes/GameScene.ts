import Phaser from 'phaser';
import { CARD_KEYS, GameConfig, type CardKey } from '../config';
import { Card, type CardPosition } from '../objects/Card';
import type { MFEBridge } from '../mfe/bridge';

interface SoundMap {
    card: Phaser.Sound.BaseSound;
    complete: Phaser.Sound.BaseSound;
    success: Phaser.Sound.BaseSound;
    theme: Phaser.Sound.BaseSound;
    timeout: Phaser.Sound.BaseSound;
}

interface HudCell {
    box: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    value: Phaser.GameObjects.Text;
    icon?: Phaser.GameObjects.Graphics;
    boxCenterX: number;
}

/**
 * GameScene runs the round: card layout, click handling, timer, best-time
 * persistence, and the shell integration via MFEBridge.
 *
 * Layout strategy (responsive):
 *   - The scene listens for `Scale.Events.RESIZE` and re-lays out
 *     everything: background, HUD bar, card grid.
 *   - Column count is picked from `GameConfig.grid.breakpoints` based on
 *     the current viewport width (4 / 3 / 2 columns).
 *   - Cards have a fixed aspect (vertical); their pixel size is derived
 *     to fit the available area minus padding and the bottom HUD bar.
 */
export class GameScene extends Phaser.Scene {
    private bridge!: MFEBridge;
    private unsubscribers: (() => void)[] = [];

    private timeoutLeft = GameConfig.timeout;
    private cards: Card[] = [];
    private ordered: Card[] = [];
    private openedCard: Card | null = null;
    private matchedPairs = 0;
    private moves = 0;

    private sounds!: SoundMap;
    private bg!: Phaser.GameObjects.Image;

    // HUD
    private hudContainer!: Phaser.GameObjects.Container;
    private hudCells: { matches: HudCell; moves: HudCell; timer: HudCell } | null = null;

    // Win popup
    private winPopup: Phaser.GameObjects.Container | null = null;

    constructor() {
        super('Game');
    }

    create(): void {
        this.bridge = this.registry.get('mfeBridge') as MFEBridge;

        this.createBackground();
        this.createHud();
        this.createSounds();
        this.createTimer();
        this.createCards();

        this.bindShellCommands();
        this.bridge.ready({
            mfeId: this.bridge.mfeId,
            version: this.bridge.protocolVersion,
            bestTime: this.getBestTime(),
            timeout: GameConfig.timeout,
        });

        this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);

        this.start();
    }

    // --- Setup -----------------------------------------------------------

    private createBackground(): void {
        const { width, height } = this.scale.gameSize;
        this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
        this.fitBackground(width, height);
    }

    private fitBackground(width: number, height: number): void {
        const tex = this.textures.get('bg').getSourceImage() as HTMLImageElement;
        // Cover the viewport, but anchor to the TOP so the logo and slot
        // machines near the top edge are never cropped — only the casino
        // floor at the bottom gets clipped when the aspect doesn't match.
        const scale = this.bgScale(width, height);
        this.bg.setScale(scale);
        const dispW = tex.width * scale;
        this.bg.setPosition((width - dispW) / 2, 0);
    }

    /** Cover scale used for the background (shared with layout math). */
    private bgScale(width: number, height: number): number {
        const tex = this.textures.get('bg').getSourceImage() as HTMLImageElement;
        return Math.max(width / tex.width, height / tex.height);
    }

    /**
     * Y coordinate where the logo ends on screen — the card grid must
     * start below this. Derived from the actual background scale so it
     * tracks the logo at every aspect ratio (the logo is baked into bg).
     */
    private logoBottomY(width: number, height: number): number {
        const tex = this.textures.get('bg').getSourceImage() as HTMLImageElement;
        const scale = this.bgScale(width, height);
        return tex.height * scale * GameConfig.layout.logoBottomRatio;
    }

    private createHud(): void {
        this.hudContainer = this.add.container(0, 0);
        // Render text at device pixel ratio so it stays crisp on retina /
        // when the RESIZE scale manager renders the canvas at >1x.
        const res = Math.max(2, window.devicePixelRatio || 1);

        const make = (label: string, withIcon = false): HudCell => {
            const box = this.add.graphics();
            const labelText = this.add
                .text(0, 0, label, {
                    fontFamily: GameConfig.ui.fontFamily,
                    fontStyle: '600',
                    fontSize: '24px',
                    color: GameConfig.ui.hudLabelColor,
                    resolution: res,
                })
                .setOrigin(0.5);
            labelText.setLetterSpacing(1);
            const valueText = this.add
                .text(0, 0, '-', {
                    fontFamily: GameConfig.ui.fontFamily,
                    fontStyle: '700',
                    fontSize: '60px',
                    color: GameConfig.ui.hudColor,
                    resolution: res,
                })
                .setOrigin(0.5)
                .setShadow(0, 2, 'rgba(0,0,0,0.65)', 4)
                .setStroke(GameConfig.colors.purple3, 3);
            const cell: HudCell = { box, label: labelText, value: valueText, boxCenterX: 0 };
            this.hudContainer.add([box, labelText, valueText]);
            if (withIcon) {
                cell.icon = this.add.graphics();
                this.hudContainer.add(cell.icon);
            }
            return cell;
        };

        this.hudCells = {
            matches: make('MATCHES'),
            moves: make('MOVES'),
            timer: make('', true),
        };
        this.updateHudValues();
    }

    private updateHudValues(): void {
        if (!this.hudCells) return;
        this.hudCells.matches.value.setText(`${this.matchedPairs}/${GameConfig.pairs}`);
        this.hudCells.moves.value.setText(String(this.moves));
        this.hudCells.timer.value.setText(this.formatTime(this.timeoutLeft));
        this.layoutTimerRow();
    }

    /**
     * Re-center the [clock][time] row in the timer box. The time width
     * changes as digits change, so this runs on every tick.
     */
    private layoutTimerRow(): void {
        const timer = this.hudCells?.timer;
        if (!timer?.icon) return;
        const cx = timer.boxCenterX;
        const valueY = timer.value.y;
        const iconSize = 20;
        const iconGap = iconSize * 0.4;
        const rowW = iconSize + iconGap + timer.value.width;
        const rowLeft = cx - rowW / 2;
        this.drawClockIcon(timer.icon, rowLeft + iconSize / 2, valueY, iconSize);
        timer.value.setOrigin(0, 0.5);
        timer.value.setPosition(rowLeft + iconSize + iconGap, valueY);
    }

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    private createSounds(): void {
        this.sounds = {
            card: this.sound.add('card'),
            complete: this.sound.add('complete'),
            success: this.sound.add('success'),
            theme: this.sound.add('theme'),
            timeout: this.sound.add('timeout'),
        };
        this.sounds.theme.play({ volume: GameConfig.themeVolume, loop: true });
    }

    private createTimer(): void {
        this.time.addEvent({
            delay: 1000,
            callback: this.onTimerTick,
            loop: true,
        });
    }

    private createCards(): void {
        this.cards = [];
        for (const value of CARD_KEYS) {
            for (let i = 0; i < 2; i++) {
                this.cards.push(new Card(this, value));
            }
        }
        this.ordered = [...this.cards];
        this.input.on('gameobjectdown', this.onCardClicked);
    }

    // --- Layout ----------------------------------------------------------

    private onResize = (size: Phaser.Structs.Size): void => {
        this.fitBackground(size.width, size.height);
        this.layoutHud(size.width, size.height);
        this.layoutCards(size.width, size.height);
        this.layoutWinPopup(size.width, size.height);
    };

    private pickColumns(width: number): number {
        for (const bp of GameConfig.grid.breakpoints) {
            if (width >= bp.minWidth) return bp.cols;
        }
        return GameConfig.grid.breakpoints[GameConfig.grid.breakpoints.length - 1].cols;
    }

    private layoutHud(width: number, height: number): void {
        if (!this.hudCells) return;
        const { hudBarHeight, sidePadding } = GameConfig.layout;

        const cells = [this.hudCells.matches, this.hudCells.moves, this.hudCells.timer];

        // Compact fixed-height bar.
        const boxHeight = hudBarHeight;
        const gap = 20;
        const maxTotalWidth = Math.min(width - sidePadding * 2, 760);
        const boxWidth = Math.min(240, (maxTotalWidth - gap * (cells.length - 1)) / cells.length);
        const totalWidth = boxWidth * cells.length + gap * (cells.length - 1);

        const startX = (width - totalWidth) / 2;
        const boxY = height - boxHeight - 16;

        // Value digits 20px; labels a touch smaller for hierarchy.
        const valuePx = 20;
        const labelPx = 16;

        cells.forEach((cell, i) => {
            const boxX = startX + i * (boxWidth + gap);
            const cx = boxX + boxWidth / 2;
            cell.boxCenterX = cx;
            this.drawHudBox(cell.box, boxX, boxY, boxWidth, boxHeight);

            cell.label.setFontSize(labelPx);
            cell.value.setFontSize(valuePx);

            if (cell.icon) {
                // Timer cell: no label — [clock][time] centered in the box.
                cell.label.setVisible(false);
                cell.value.y = boxY + boxHeight * 0.5;
                this.layoutTimerRow();
            } else {
                // Label near the top, value centered below.
                cell.label.setVisible(true);
                cell.label.setPosition(cx, boxY + boxHeight * 0.3);
                cell.value.setOrigin(0.5);
                cell.value.setPosition(cx, boxY + boxHeight * 0.66);
            }
        });
    }

    /** Rounded stat box: purple gradient fill + gold border. */
    private drawHudBox(
        g: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        w: number,
        h: number,
    ): void {
        const r = 16;
        g.clear();
        // Vertical gradient approximated with two stacked fills.
        g.fillStyle(0x1d0129, 0.96);
        g.fillRoundedRect(x, y, w, h, r);
        g.fillStyle(0x120018, 0.55);
        g.fillRoundedRect(x, y + h * 0.5, w, h * 0.5, { tl: 0, tr: 0, bl: r, br: r });
        // Gold border + subtle inner highlight.
        g.lineStyle(2, 0x8a5a14, 1);
        g.strokeRoundedRect(x, y, w, h, r);
        g.lineStyle(1, 0xffbe46, 0.18);
        g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
    }

    /** Stopwatch glyph (face + top stem/button + side nubs + hands). */
    private drawClockIcon(
        g: Phaser.GameObjects.Graphics,
        cx: number,
        cy: number,
        size: number,
    ): void {
        const r = size / 2;
        const lw = Math.max(2, size * 0.08);
        const gold = 0xfff3c4;
        g.clear();

        // Face centered slightly below to leave room for the top button.
        const faceCy = cy + size * 0.08;
        const faceR = r * 0.82;

        // Side nubs (little buttons at ~45°).
        g.lineStyle(lw, gold, 1);
        const nub = faceR * 0.22;
        const nx = Math.cos(Phaser.Math.DegToRad(55)) * faceR;
        const ny = Math.sin(Phaser.Math.DegToRad(55)) * faceR;
        g.lineBetween(cx - nx, faceCy - ny, cx - nx - nub, faceCy - ny - nub);
        g.lineBetween(cx + nx, faceCy - ny, cx + nx + nub, faceCy - ny - nub);

        // Top stem + button (the press knob on a stopwatch).
        g.lineBetween(cx, faceCy - faceR, cx, faceCy - faceR - size * 0.14);
        g.fillStyle(gold, 1);
        g.fillRoundedRect(
            cx - size * 0.12,
            faceCy - faceR - size * 0.24,
            size * 0.24,
            size * 0.12,
            size * 0.04,
        );

        // Face ring.
        g.lineStyle(lw, gold, 1);
        g.strokeCircle(cx, faceCy, faceR);

        // Hands: one up, one to the upper-right.
        g.lineBetween(cx, faceCy, cx, faceCy - faceR * 0.6);
        g.lineBetween(cx, faceCy, cx + faceR * 0.42, faceCy - faceR * 0.1);
    }

    private layoutCards(width: number, height: number): void {
        const cols = this.pickColumns(width);
        const rows = Math.ceil(this.cards.length / cols);
        const { sidePadding, verticalPadding, hudReserveRatio, maxCardHeight } = GameConfig.layout;

        // Top reserve tracks the logo baked into the background (so cards
        // never overlap it). Bottom reserve is the HUD area.
        const availableTop = this.logoBottomY(width, height) + verticalPadding;
        // Extra 30px breathing room between the card grid and the HUD bar.
        const availableBottom = height * (1 - hudReserveRatio) - verticalPadding - 30;
        const availableWidth = width - sidePadding * 2;
        const availableHeight = Math.max(120, availableBottom - availableTop);

        // Compute per-card size that fits both width and height constraints.
        const gap = GameConfig.cardGap;
        const cellWidthByGrid = (availableWidth - gap * (cols - 1)) / cols;
        const cellHeightByGrid = (availableHeight - gap * (rows - 1)) / rows;

        // Honor the design aspect (width / height).
        let cardW = cellWidthByGrid;
        let cardH = cardW / GameConfig.cardAspect;
        if (cardH > cellHeightByGrid) {
            cardH = cellHeightByGrid;
            cardW = cardH * GameConfig.cardAspect;
        }
        // Hard cap so cards don't grow huge (and overlap the logo) when the
        // viewport is stretched wide.
        if (cardH > maxCardHeight) {
            cardH = maxCardHeight;
            cardW = cardH * GameConfig.cardAspect;
        }

        const totalGridW = cols * cardW + (cols - 1) * gap;
        const totalGridH = rows * cardH + (rows - 1) * gap;
        const startX = (width - totalGridW) / 2 + cardW / 2;
        const startY = availableTop + (availableHeight - totalGridH) / 2 + cardH / 2;

        // `this.ordered` is the shuffled placement order: index i in this
        // array maps to grid cell i. That's what randomizes card positions.
        for (let i = 0; i < this.ordered.length; i++) {
            const card = this.ordered[i];
            const r = Math.floor(i / cols);
            const c = i % cols;
            const x = startX + c * (cardW + gap);
            const y = startY + r * (cardH + gap);
            card.setCardSize(cardW, cardH);
            // Keep the existing stagger delay; only update resting position.
            card.position = { x, y, delay: card.position?.delay ?? 0 };
            // If a card already settled (no active tween targeting it),
            // snap it to the new spot for resize responsiveness.
            if (!this.tweens.isTweening(card)) {
                card.setPosition(x, y);
            }
        }
    }

    // --- Game flow -------------------------------------------------------

    private start(): void {
        this.timeoutLeft = GameConfig.timeout;
        this.openedCard = null;
        this.matchedPairs = 0;
        this.moves = 0;
        this.updateHudValues();
        this.hideWinPopup();

        const { width, height } = this.scale.gameSize;
        this.layoutHud(width, height);
        this.shuffleOrder();
        this.layoutCards(width, height);
        this.flyInCards();

        this.bridge.emit('gameStart', { timeout: GameConfig.timeout });
    }

    /**
     * Shuffle the placement order and assign stagger delays. `this.ordered`
     * drives both grid position (in layoutCards) and fly-in timing.
     */
    private shuffleOrder(): void {
        this.ordered = Phaser.Utils.Array.Shuffle([...this.cards]);
        this.ordered.forEach((card, order) => {
            card.position = {
                x: 0,
                y: 0,
                delay: order * GameConfig.animation.cardMoveStaggerDelay,
            };
        });
    }

    private flyInCards(): void {
        this.cards.forEach((card) => {
            const target: CardPosition = card.position;
            // Reset to off-screen, then tween to the layout target.
            card.init(target);
            card.move(target);
        });
    }

    private onCardClicked = (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
    ): void => {
        if (!(gameObject instanceof Card)) return;
        const card = gameObject;
        if (card.opened) return;

        this.sounds.card.play();

        if (this.openedCard) {
            this.moves += 1;
            if (this.openedCard.value === card.value) {
                this.sounds.success.play();
                this.matchedPairs += 1;
                this.bridge.emit('match', {
                    value: cardKeyToNumber(card.value),
                    matched: this.matchedPairs,
                    total: GameConfig.pairs,
                });
                this.openedCard = null;
            } else {
                this.bridge.emit('mismatch', {
                    values: [cardKeyToNumber(this.openedCard.value), cardKeyToNumber(card.value)],
                });
                this.openedCard.close();
                this.openedCard = card;
            }
        } else {
            this.openedCard = card;
        }

        card.open();
        this.updateHudValues();

        if (this.matchedPairs === GameConfig.pairs) {
            this.sounds.complete.play();
            const elapsed = GameConfig.timeout - this.timeoutLeft;
            this.bridge.emit('win', { time: elapsed });
            this.saveBestTime(elapsed);
            this.showWinPopup();
        }
    };

    private onTimerTick = (): void => {
        if (this.matchedPairs === GameConfig.pairs) return; // round won, freeze timer

        if (this.timeoutLeft <= 0) {
            this.sounds.timeout.play();
            this.bridge.emit('timeout', {});
            this.start();
            return;
        }
        this.timeoutLeft -= 1;
        this.updateHudValues();
    };

    // --- Win popup -------------------------------------------------------

    private showWinPopup(): void {
        if (this.winPopup) return;
        const { width, height } = this.scale.gameSize;
        const { colors, ui } = GameConfig;

        const popup = this.add.image(0, 0, 'background-win');
        const res = Math.max(2, window.devicePixelRatio || 1);

        // Text inside the frame. "AMAZING!" sits in the lower-mid of the
        // frame, "ALL PAIRS FOUND!" just below it. Both are centered.
        const amazing = this.add
            .text(0, 0, 'AMAZING!', {
                fontFamily: ui.fontFamilyDecorative,
                fontStyle: '700',
                fontSize: '44px',
                color: colors.gold1,
                align: 'center',
                resolution: res,
            })
            .setOrigin(0.5)
            .setStroke(colors.purple3, 6)
            .setShadow(0, 3, colors.gold3, 6, true, true);

        const subtitle = this.add
            .text(0, 0, 'ALL PAIRS FOUND!', {
                fontFamily: ui.fontFamily,
                fontStyle: '600',
                fontSize: '22px',
                color: colors.whiteWarm,
                align: 'center',
                resolution: res,
            })
            .setOrigin(0.5)
            .setStroke(colors.purple3, 4);

        const container = this.add.container(width / 2, height / 2, [popup, amazing, subtitle]);
        container.setAlpha(0).setScale(0.6);
        this.winPopup = container;

        this.layoutWinPopup(width, height);
        this.tweens.add({
            targets: container,
            alpha: 1,
            scale: 1,
            ease: 'Back.Out',
            duration: GameConfig.animation.winPopupDuration,
        });

        // Restart shortly after, so the player can savor the popup.
        this.time.delayedCall(4200, () => this.start());
    }

    private hideWinPopup(): void {
        if (!this.winPopup) return;
        this.winPopup.destroy(true);
        this.winPopup = null;
    }

    private layoutWinPopup(width: number, height: number): void {
        if (!this.winPopup) return;
        const popup = this.winPopup.getAt<Phaser.GameObjects.Image>(0);
        const amazing = this.winPopup.getAt<Phaser.GameObjects.Text>(1);
        const subtitle = this.winPopup.getAt<Phaser.GameObjects.Text>(2);

        // Smaller popup: fit within ~45% width and ~55% height, whichever
        // is more restrictive (the frame is portrait, 1024x1536).
        const tex = this.textures.get('background-win').getSourceImage();
        const maxW = Math.min(width * 0.5, 460);
        const maxH = height * 0.6;
        const scale = Math.min(maxW / tex.width, maxH / tex.height);

        const popupW = tex.width * scale;
        const popupH = tex.height * scale;
        popup.setDisplaySize(popupW, popupH);

        this.winPopup.setPosition(width / 2, height / 2);

        // Text is centered within the frame. Offsets are fractions of the
        // popup height relative to the container center.
        amazing.setPosition(0, -popupH * 0.02);
        subtitle.setPosition(0, popupH * 0.08);

        // Scale font sizes with the popup so text never overflows the frame.
        const titlePx = Math.round(Phaser.Math.Clamp(popupH * 0.06, 16, 34));
        const subPx = Math.round(Phaser.Math.Clamp(popupH * 0.038, 11, 20));
        amazing.setFontSize(titlePx);
        subtitle.setFontSize(subPx);
    }

    // --- Shell command bindings -----------------------------------------

    private bindShellCommands(): void {
        const sub = <T extends Parameters<MFEBridge['on']>[0]>(
            type: T,
            fn: Parameters<MFEBridge['on']>[1],
        ) => {
            this.unsubscribers.push(this.bridge.on(type, fn));
        };

        sub('pause', () => {
            if (!this.scene.isPaused()) {
                this.scene.pause();
                (this.sounds.theme as Phaser.Sound.WebAudioSound).pause();
                this.bridge.emit('paused', {});
            }
        });

        sub('resume', () => {
            if (this.scene.isPaused()) {
                this.scene.resume();
                (this.sounds.theme as Phaser.Sound.WebAudioSound).resume();
                this.bridge.emit('resumed', {});
            }
        });

        sub('restart', () => {
            this.start();
        });

        sub('mute', (payload) => {
            const muted = Boolean((payload as { muted?: unknown }).muted);
            this.sound.mute = muted;
            this.bridge.emit('muteChanged', { muted: this.sound.mute });
        });

        sub('setVolume', (payload) => {
            const raw = Number((payload as { volume?: unknown }).volume);
            const v = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
            this.sound.volume = v;
            this.bridge.emit('volumeChanged', { volume: v });
        });
    }

    private onShutdown = (): void => {
        for (const off of this.unsubscribers) off();
        this.unsubscribers = [];
        this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
        this.input.off('gameobjectdown', this.onCardClicked);
    };

    // --- Best-time persistence ------------------------------------------

    private getBestTime(): number | null {
        const value = localStorage.getItem(GameConfig.storage.bestTimeKey);
        return value === null ? null : parseInt(value, 10);
    }

    private saveBestTime(seconds: number): void {
        const best = this.getBestTime();
        if (best === null || seconds < best) {
            localStorage.setItem(GameConfig.storage.bestTimeKey, String(seconds));
            this.bridge.emit('bestTimeUpdated', { bestTime: seconds });
        }
    }
}

// CardKey enum maps to numbers for the shell protocol.
function cardKeyToNumber(key: CardKey): number {
    return CARD_KEYS.indexOf(key) + 1;
}
