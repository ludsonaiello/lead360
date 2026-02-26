import { Module, Global } from '@nestjs/common';
import { PuppeteerProcessManager } from './puppeteer-process-manager.service';

/**
 * PuppeteerProcessManagerModule
 *
 * Global module that provides centralized Puppeteer browser management.
 *
 * Features:
 * - Singleton browser instance shared across all modules
 * - Automatic orphan process cleanup on startup
 * - Graceful shutdown handling
 *
 * Usage:
 * Import this module in AppModule, then inject PuppeteerProcessManager
 * in any service that needs PDF generation.
 *
 * @author System
 */
@Global()
@Module({
  providers: [PuppeteerProcessManager],
  exports: [PuppeteerProcessManager],
})
export class PuppeteerProcessManagerModule {}
