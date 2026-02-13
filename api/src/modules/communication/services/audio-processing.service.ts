import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execFilePromise = promisify(execFile);

export interface AudioValidationResult {
  isValid: boolean;
  format?: string;
  sampleRate?: number;
  duration?: number;
  channels?: number;
  errorMessage?: string;
}

/**
 * Service for audio file processing using ffmpeg
 * Handles channel detection, stereo splitting, and file validation
 *
 * SECURITY: Uses execFile instead of exec to prevent command injection
 */
@Injectable()
export class AudioProcessingService {
  private readonly logger = new Logger(AudioProcessingService.name);

  /**
   * Detects if audio file is mono or stereo
   * @param filePath - Path to the audio file
   * @returns 1 for mono, 2 for stereo
   * @throws Error if detection fails or channel count is invalid
   */
  async detectChannelCount(filePath: string): Promise<number> {
    try {
      this.logger.debug(`Detecting channel count for: ${filePath}`);

      const { stdout, stderr } = await execFilePromise('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=channels',
        '-of',
        'csv=p=0',
        filePath,
      ]);

      const channelCount = parseInt(stdout.trim(), 10);

      // Validate channel count
      if (isNaN(channelCount) || channelCount < 1) {
        this.logger.error(
          `Invalid channel count detected: ${stdout.trim()}`,
          stderr,
        );
        throw new Error(`Invalid channel count detected: ${stdout.trim()}`);
      }

      // Only support mono and stereo
      if (channelCount > 2) {
        this.logger.error(
          `Unsupported channel count: ${channelCount}. Only mono (1) and stereo (2) are supported.`,
        );
        throw new Error(
          `Unsupported channel count: ${channelCount}. Only mono (1) and stereo (2) are supported.`,
        );
      }

      this.logger.debug(
        `Detected ${channelCount} channel(s) in file: ${filePath}`,
      );
      return channelCount;
    } catch (error) {
      this.logger.error(
        `Failed to detect channel count for ${filePath}:`,
        error,
      );

      // Re-throw with more context if it's our custom error
      if (error.message.includes('Unsupported channel count')) {
        throw error;
      }

      throw new Error(`Channel detection failed: ${error.message}`);
    }
  }

  /**
   * Splits stereo audio into two mono WAV files
   * @param stereoFilePath - Path to the stereo audio file
   * @param outputDir - Directory where the channel files will be created
   * @returns Object with paths to channel1 and channel2 WAV files
   * @throws Error if splitting fails
   */
  async splitStereoChannels(
    stereoFilePath: string,
    outputDir: string,
  ): Promise<{ channel1Path: string; channel2Path: string }> {
    try {
      this.logger.debug(`Splitting stereo file: ${stereoFilePath}`);

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      const channel1Path = path.join(outputDir, 'channel1.wav');
      const channel2Path = path.join(outputDir, 'channel2.wav');

      // Split channel 1 (left) - SECURITY: Using execFile with array arguments
      this.logger.debug(`Extracting channel 1 (left) to: ${channel1Path}`);
      await execFilePromise('ffmpeg', [
        '-i',
        stereoFilePath,
        '-map_channel',
        '0.0.0',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-f',
        'wav',
        channel1Path,
        '-y', // Overwrite if exists
      ]);

      // Split channel 2 (right) - SECURITY: Using execFile with array arguments
      this.logger.debug(`Extracting channel 2 (right) to: ${channel2Path}`);
      await execFilePromise('ffmpeg', [
        '-i',
        stereoFilePath,
        '-map_channel',
        '0.0.1',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-f',
        'wav',
        channel2Path,
        '-y', // Overwrite if exists
      ]);

      // Verify both files were created and are not empty
      const [channel1Stats, channel2Stats] = await Promise.all([
        fs.stat(channel1Path),
        fs.stat(channel2Path),
      ]);

      if (channel1Stats.size === 0 || channel2Stats.size === 0) {
        throw new Error('Channel splitting produced empty files');
      }

      this.logger.debug(
        `Successfully split stereo file into ${channel1Stats.size} bytes (ch1) and ${channel2Stats.size} bytes (ch2)`,
      );

      return { channel1Path, channel2Path };
    } catch (error) {
      this.logger.error(
        `Failed to split stereo channels for ${stereoFilePath}:`,
        error,
      );
      throw new Error(`Channel splitting failed: ${error.message}`);
    }
  }

  /**
   * Validates audio file format and quality
   * @param filePath - Path to the audio file
   * @returns Validation result with file metadata
   */
  async validateAudioFile(filePath: string): Promise<AudioValidationResult> {
    try {
      this.logger.debug(`Validating audio file: ${filePath}`);

      // Check if file exists
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        return {
          isValid: false,
          errorMessage: 'Audio file is empty',
        };
      }

      // Get audio file metadata using ffprobe - SECURITY: Using execFile
      const { stdout } = await execFilePromise('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_name,sample_rate,channels,duration',
        '-of',
        'json',
        filePath,
      ]);

      const metadata = JSON.parse(stdout);

      if (!metadata.streams || metadata.streams.length === 0) {
        return {
          isValid: false,
          errorMessage: 'No audio streams found in file',
        };
      }

      const audioStream = metadata.streams[0];

      return {
        isValid: true,
        format: audioStream.codec_name,
        sampleRate: parseInt(audioStream.sample_rate, 10),
        channels: parseInt(audioStream.channels, 10),
        duration: parseFloat(audioStream.duration),
      };
    } catch (error) {
      this.logger.error(`Failed to validate audio file ${filePath}:`, error);
      return {
        isValid: false,
        errorMessage: `Validation failed: ${error.message}`,
      };
    }
  }

  /**
   * Cleans up temporary audio files and directories
   * @param filePaths - Array of file or directory paths to delete
   */
  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    try {
      this.logger.debug(
        `Cleaning up ${filePaths.length} temp file(s)/directory(s)`,
      );

      await Promise.all(
        filePaths.map(async (filePath) => {
          try {
            const stats = await fs.stat(filePath);

            if (stats.isDirectory()) {
              // Remove directory and all contents
              await fs.rm(filePath, { recursive: true, force: true });
              this.logger.debug(`Deleted temp directory: ${filePath}`);
            } else {
              // Remove single file
              await fs.unlink(filePath);
              this.logger.debug(`Deleted temp file: ${filePath}`);
            }
          } catch (error) {
            // Log error but don't throw - cleanup is best-effort
            this.logger.warn(`Failed to delete ${filePath}:`, error.message);
          }
        }),
      );

      this.logger.debug('Temp file cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup operation encountered an error:', error);
    }
  }
}
