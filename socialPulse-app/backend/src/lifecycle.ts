import { Server } from 'http';
import { closeDB } from './config/database';

export type CleanupHandler = () => Promise<void> | void;

export class LifecycleManager {
    private static server: Server | null = null;
    private static isShuttingDown = false;
    private static shutdownTimeoutMs = 5000;
    private static cleanupHandlers: Map<string, CleanupHandler> = new Map();
    private static activeIntervals: NodeJS.Timeout[] = [];

    public static registerServer(server: Server): void {
        this.server = server;
    }

    public static registerInterval(interval: NodeJS.Timeout): void {
        this.activeIntervals.push(interval);
    }

    public static registerCleanup(name: string, handler: CleanupHandler): void {
        this.cleanupHandlers.set(name, handler);
    }

    public static getIsShuttingDown(): boolean {
        return this.isShuttingDown;
    }

    public static resetForTesting(): void {
        this.isShuttingDown = false;
        this.activeIntervals = [];
        this.cleanupHandlers.clear();
        this.server = null;
    }

    public static async shutdown(signal = 'SIGTERM', drainPool = true): Promise<void> {
        if (this.isShuttingDown) {
            console.log(`[LifecycleManager] Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
            return;
        }

        this.isShuttingDown = true;
        console.log(`[LifecycleManager] Received ${signal}. Starting graceful shutdown...`);

        const forceExitTimer = setTimeout(() => {
            console.error('[LifecycleManager] Shutdown timed out. Forcing process termination.');
            if (process.env.NODE_ENV !== 'test') {
                process.exit(1);
            }
        }, this.shutdownTimeoutMs);

        try {
            // 1. Clear background intervals/timers
            for (const interval of this.activeIntervals) {
                clearInterval(interval);
            }
            this.activeIntervals = [];

            // 2. Stop accepting new HTTP requests
            if (this.server) {
                await new Promise<void>((resolve) => {
                    this.server?.close((err) => {
                        if (err) console.error('[LifecycleManager] Error closing HTTP server:', err.message);
                        else console.log('[LifecycleManager] HTTP server closed.');
                        resolve();
                    });
                });
            }

            // 3. Execute registered subsystem cleanup handlers (e.g. Redis, workers)
            for (const [name, handler] of this.cleanupHandlers.entries()) {
                try {
                    await handler();
                    console.log(`[LifecycleManager] Cleanup handler "${name}" completed.`);
                } catch (err: any) {
                    console.error(`[LifecycleManager] Error in cleanup handler "${name}":`, err.message);
                }
            }

            // 4. Drain and close database pool
            if (drainPool && process.env.NODE_ENV !== 'test') {
                try {
                    await closeDB();
                    console.log('[LifecycleManager] PostgreSQL connection pool drained.');
                } catch (err: any) {
                    console.error('[LifecycleManager] Error draining database pool:', err.message);
                }
            }

            // 5. Clear force exit timer
            clearTimeout(forceExitTimer);
            console.log('[LifecycleManager] Graceful shutdown completed cleanly.');

            if (process.env.NODE_ENV !== 'test') {
                process.exit(0);
            }
        } catch (err: any) {
            clearTimeout(forceExitTimer);
            console.error('[LifecycleManager] Fatal error during shutdown:', err.message);
            if (process.env.NODE_ENV !== 'test') {
                process.exit(1);
            }
        }
    }

    public static initProcessSignals(): void {
        if (process.env.NODE_ENV === 'test') return;

        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('SIGINT', () => this.shutdown('SIGINT'));
    }
}
