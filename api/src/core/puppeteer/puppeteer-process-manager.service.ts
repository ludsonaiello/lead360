import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Browser } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * PuppeteerProcessManager
 *
 * Centralized manager for Puppeteer browser instances with orphan process cleanup.
 *
 * Key Features:
 * - Singleton browser instance (reused across all PDF generations)
 * - Automatic orphan process cleanup on startup
 * - PID tracking for health monitoring
 * - Graceful shutdown with proper cleanup
 * - Health check APIs
 *
 * Orphan Detection Strategy:
 * - On startup, check for PID file from previous runs
 * - Kill processes matching Puppeteer Chrome patterns
 * - Clean up temp directories
 *
 * @author System
 */
@Injectable()
export class PuppeteerProcessManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerProcessManager.name);
  private browser: Browser | null = null;
  private readonly pidFilePath = '/tmp/lead360-puppeteer.pid';
  private browserPid: number | null = null;
  private isShuttingDown = false;
  private browserRestartPromise: Promise<Browser> | null = null; // Mutex for getBrowser()

  /**
   * Initialize on module startup
   * - Clean up orphaned processes
   * - Launch browser
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing Puppeteer Process Manager...');

      // Step 1: Kill orphaned processes from previous runs
      const orphansKilled = await this.killOrphanedProcesses();
      if (orphansKilled > 0) {
        this.logger.warn(
          `Cleaned up ${orphansKilled} orphaned Chrome processes from previous run`,
        );
      }

      // Step 2: Launch new browser instance
      this.logger.log('Launching Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      // Step 3: Track browser PID
      const browserProcess = this.browser.process();
      if (browserProcess && browserProcess.pid) {
        this.browserPid = browserProcess.pid;
        await this.storePidAsync(this.browserPid);
        this.logger.log(
          `Puppeteer browser launched successfully (PID: ${this.browserPid})`,
        );
      } else {
        this.logger.error(
          'CRITICAL: Could not retrieve browser PID - orphan cleanup will fail',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize Puppeteer browser: ${error.message}`,
        error.stack,
      );
      // Don't throw - allow app to start even if PDF generation is unavailable
    }
  }

  /**
   * Cleanup on module shutdown
   */
  async onModuleDestroy() {
    this.isShuttingDown = true;

    if (this.browser) {
      try {
        this.logger.log('Closing Puppeteer browser...');

        // Close browser with timeout (prevent hanging)
        await Promise.race([
          this.browser.close(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Browser close timeout')), 10000),
          ),
        ]);

        await this.clearPidAsync();
        this.logger.log('Puppeteer browser closed successfully');
      } catch (error) {
        this.logger.error(
          `Error closing Puppeteer browser: ${error.message}`,
          error.stack,
        );
        // Force kill if close failed
        if (this.browserPid) {
          try {
            process.kill(this.browserPid, 'SIGKILL');
            this.logger.warn(`Force killed browser process ${this.browserPid}`);
          } catch (killError) {
            this.logger.debug(`Could not force kill: ${killError.message}`);
          }
        }
      } finally {
        this.browser = null;
        this.browserPid = null;
      }
    }
  }

  /**
   * Get the browser instance (singleton)
   *
   * If browser is not initialized or was closed, this will attempt to restart it.
   * Uses a mutex to prevent concurrent browser launches.
   *
   * @returns Browser instance
   * @throws Error if browser cannot be initialized
   */
  async getBrowser(): Promise<Browser> {
    // Fast path: browser is healthy
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // Check if another request is already restarting the browser
    if (this.browserRestartPromise) {
      this.logger.debug('Browser restart already in progress, waiting...');
      return this.browserRestartPromise;
    }

    // Browser is null or disconnected - initiate restart with mutex
    this.logger.warn(
      'Browser not initialized or disconnected, attempting to restart...',
    );

    // Create restart promise and store it (mutex)
    this.browserRestartPromise = this.restartBrowser();

    try {
      const browser = await this.browserRestartPromise;
      return browser;
    } finally {
      // Release mutex
      this.browserRestartPromise = null;
    }
  }

  /**
   * Internal method to restart browser (called by getBrowser with mutex)
   */
  private async restartBrowser(): Promise<Browser> {
    try {
      // Close existing browser if it exists but is disconnected
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          this.logger.debug(
            'Error closing disconnected browser:',
            error.message,
          );
        }
        this.browser = null;
      }

      // Launch new browser
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', // TODO: Security risk - document or fix
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const browserProcess = this.browser.process();
      if (browserProcess && browserProcess.pid) {
        this.browserPid = browserProcess.pid;
        await this.storePidAsync(this.browserPid);
        this.logger.log(
          `Browser restarted successfully (PID: ${this.browserPid})`,
        );
      } else {
        this.logger.error(
          'CRITICAL: Browser launched but PID unavailable - orphan cleanup will fail',
        );
      }

      return this.browser;
    } catch (error) {
      this.logger.error(
        `Failed to restart browser: ${error.message}`,
        error.stack,
      );
      this.browser = null;
      throw new Error(
        'PDF generation unavailable - browser initialization failed',
      );
    }
  }

  /**
   * Manually close the browser (for maintenance/testing)
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      await this.clearPidAsync();
      this.browser = null;
      this.browserPid = null;
      this.logger.log('Browser manually closed');
    }
  }

  /**
   * Kill orphaned Chrome processes from previous runs
   *
   * Strategy:
   * 1. Check if PID file exists from previous run
   * 2. If yes, try to kill that specific PID
   * 3. Then scan for all Puppeteer Chrome processes
   * 4. Kill any that match the pattern
   * 5. Clean up temp directories
   *
   * @returns Number of orphaned processes killed
   */
  async killOrphanedProcesses(): Promise<number> {
    let killed = 0;

    try {
      // Step 1: Check for PID from previous run
      const oldPid = this.loadPid();
      if (oldPid) {
        this.logger.debug(`Found PID file from previous run: ${oldPid}`);
        try {
          // Check if process exists
          process.kill(oldPid, 0); // Signal 0 just checks if process exists
          // If we get here, process exists - kill it
          process.kill(oldPid, 'SIGTERM');
          this.logger.debug(`Killed previous browser process (PID: ${oldPid})`);
          killed++;

          // Give it a moment to die
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Force kill if still alive
          try {
            process.kill(oldPid, 0);
            process.kill(oldPid, 'SIGKILL');
            this.logger.debug(`Force killed stubborn process (PID: ${oldPid})`);
          } catch (error) {
            // Process is dead, that's good
          }
        } catch (error) {
          // Process doesn't exist, that's fine
          this.logger.debug(`Previous PID ${oldPid} no longer exists`);
        }
      }

      // Step 2: Find all Chrome processes that match Puppeteer pattern
      try {
        const { stdout } = await execAsync(
          'pgrep -f "chrome-linux64/chrome" || true',
        );

        if (stdout.trim()) {
          const pidStrings = stdout
            .trim()
            .split('\n')
            .filter((pid) => pid);

          this.logger.debug(
            `Found ${pidStrings.length} Chrome processes: ${pidStrings.join(', ')}`,
          );

          // Kill each process using native process.kill() (safer than shell exec)
          for (const pidStr of pidStrings) {
            // Validate PID format (security: prevent command injection)
            if (!/^\d+$/.test(pidStr)) {
              this.logger.warn(`Skipping invalid PID format: "${pidStr}"`);
              continue;
            }

            const pid = parseInt(pidStr, 10);

            try {
              // Check if process exists
              process.kill(pid, 0);
              // Process exists, kill it
              process.kill(pid, 'SIGTERM');
              killed++;
              this.logger.debug(`Sent SIGTERM to Chrome process PID: ${pid}`);
            } catch (error) {
              if (error.code === 'ESRCH') {
                this.logger.debug(`PID ${pid} no longer exists`);
              } else if (error.code === 'EPERM') {
                this.logger.warn(`No permission to kill PID ${pid}`);
              } else {
                this.logger.debug(
                  `Could not kill PID ${pid}: ${error.message}`,
                );
              }
            }
          }

          // Give processes time to die gracefully
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Force kill any remaining processes
          for (const pidStr of pidStrings) {
            if (!/^\d+$/.test(pidStr)) continue;
            const pid = parseInt(pidStr, 10);

            try {
              process.kill(pid, 0); // Check if still alive
              process.kill(pid, 'SIGKILL'); // Force kill
              this.logger.debug(`Force killed stubborn process PID: ${pid}`);
            } catch (error) {
              // Process is dead or we can't kill it - that's fine
            }
          }
        }
      } catch (error) {
        this.logger.debug(`Error finding Chrome processes: ${error.message}`);
      }

      // Step 3: Clean up temp directories
      try {
        await execAsync(
          'rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true',
        );
        this.logger.debug('Cleaned up Puppeteer temp directories');
      } catch (error) {
        this.logger.debug(`Could not clean temp directories: ${error.message}`);
      }

      // Step 4: Clear PID file
      this.clearPidSync();

      return killed;
    } catch (error) {
      this.logger.error(
        `Error during orphan cleanup: ${error.message}`,
        error.stack,
      );
      return killed;
    }
  }

  /**
   * Get health status of browser and Chrome processes
   *
   * Note: Orphan detection is best-effort. We report all Chrome processes
   * as potential orphans if no browser is connected, or just the total count
   * if a browser is running (since we can't reliably count child processes).
   *
   * @returns Health information
   */
  async getProcessHealth(): Promise<{
    browser_alive: boolean;
    browser_connected: boolean;
    browser_pid: number | null;
    total_chrome_processes: number;
    temp_profiles: number;
  }> {
    const browserAlive = this.browser !== null;
    const browserConnected = this.browser?.connected || false;

    // Count total Chrome processes (best-effort orphan detection)
    let totalChromeProcesses = 0;
    try {
      const { stdout } = await execAsync(
        'pgrep -f "chrome-linux64/chrome" | wc -l',
      );
      totalChromeProcesses = parseInt(stdout.trim(), 10) || 0;
    } catch (error) {
      this.logger.debug(`Error counting Chrome processes: ${error.message}`);
    }

    // Count temp profiles
    let tempProfiles = 0;
    try {
      const { stdout } = await execAsync(
        'ls -1d /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null | wc -l',
      );
      tempProfiles = parseInt(stdout.trim(), 10) || 0;
    } catch (error) {
      this.logger.debug(`Error counting temp profiles: ${error.message}`);
    }

    return {
      browser_alive: browserAlive,
      browser_connected: browserConnected,
      browser_pid: this.browserPid,
      total_chrome_processes: totalChromeProcesses,
      temp_profiles: tempProfiles,
    };
  }

  /**
   * Store browser PID to file for orphan detection (async)
   */
  private async storePidAsync(pid: number): Promise<void> {
    try {
      await fs.promises.writeFile(this.pidFilePath, pid.toString(), 'utf8');
      this.logger.debug(`Stored browser PID ${pid} to ${this.pidFilePath}`);
    } catch (error) {
      this.logger.error(
        `CRITICAL: Failed to store PID file: ${error.message}. Orphan cleanup will fail on next restart!`,
      );
    }
  }

  /**
   * Load PID from file (from previous run) with validation
   */
  private loadPid(): number | null {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        const pidStr = fs.readFileSync(this.pidFilePath, 'utf8').trim();

        // Validate PID format
        if (!/^\d+$/.test(pidStr)) {
          this.logger.error(
            `Corrupted PID file: contains invalid data "${pidStr}". Deleting.`,
          );
          this.clearPidSync();
          return null;
        }

        const pid = parseInt(pidStr, 10);

        // Additional validation
        if (isNaN(pid) || pid <= 0 || pid > 2147483647) {
          this.logger.error(`Invalid PID in file: ${pid}. Deleting PID file.`);
          this.clearPidSync();
          return null;
        }

        return pid;
      }
    } catch (error) {
      this.logger.warn(`Could not load PID file: ${error.message}`);
    }
    return null;
  }

  /**
   * Clear PID file (sync - used in critical paths)
   */
  private clearPidSync(): void {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        fs.unlinkSync(this.pidFilePath);
        this.logger.debug('Cleared PID file');
      }
    } catch (error) {
      this.logger.debug(`Could not clear PID file: ${error.message}`);
    }
  }

  /**
   * Clear PID file (async)
   */
  private async clearPidAsync(): Promise<void> {
    try {
      await fs.promises.unlink(this.pidFilePath);
      this.logger.debug('Cleared PID file');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.debug(`Could not clear PID file: ${error.message}`);
      }
    }
  }

  /**
   * Check if manager is shutting down
   */
  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }
}
