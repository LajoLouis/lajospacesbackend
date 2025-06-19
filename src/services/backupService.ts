import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Backup Service for LajoSpaces Backend
 * Handles database backups, file backups, and backup management
 */

const execAsync = promisify(exec);

export interface BackupConfig {
  mongodb: {
    enabled: boolean;
    schedule: string; // cron format
    retention: number; // days
    compression: boolean;
  };
  files: {
    enabled: boolean;
    directories: string[];
    schedule: string;
    retention: number;
  };
  storage: {
    local: {
      enabled: boolean;
      path: string;
    };
    cloud: {
      enabled: boolean;
      provider: 'aws' | 'gcp' | 'azure';
      bucket?: string;
    };
  };
}

export interface BackupMetadata {
  id: string;
  type: 'mongodb' | 'files' | 'full';
  timestamp: Date;
  size: number;
  status: 'success' | 'failed' | 'in_progress';
  path: string;
  checksum?: string;
  error?: string;
}

class BackupService {
  private backupConfig: BackupConfig;
  private backupHistory: BackupMetadata[] = [];
  private readonly BACKUP_DIR = path.join(process.cwd(), 'backups');

  constructor() {
    this.backupConfig = {
      mongodb: {
        enabled: config.NODE_ENV === 'production',
        schedule: '0 2 * * *', // Daily at 2 AM
        retention: 30, // 30 days
        compression: true
      },
      files: {
        enabled: config.NODE_ENV === 'production',
        directories: ['uploads', 'logs', 'config'],
        schedule: '0 3 * * *', // Daily at 3 AM
        retention: 7 // 7 days
      },
      storage: {
        local: {
          enabled: true,
          path: this.BACKUP_DIR
        },
        cloud: {
          enabled: false,
          provider: 'aws'
        }
      }
    };

    this.initializeBackupDirectory();
  }

  /**
   * Initialize backup directory
   */
  private async initializeBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });
      await fs.mkdir(path.join(this.BACKUP_DIR, 'mongodb'), { recursive: true });
      await fs.mkdir(path.join(this.BACKUP_DIR, 'files'), { recursive: true });
      logger.info('Backup directories initialized', { backupDir: this.BACKUP_DIR });
    } catch (error) {
      logger.error('Failed to initialize backup directories', { error: error.message });
    }
  }

  /**
   * Create MongoDB backup
   */
  async createMongoDBBackup(): Promise<BackupMetadata> {
    const backupId = `mongodb_${Date.now()}`;
    const timestamp = new Date();
    const filename = `${backupId}.gz`;
    const backupPath = path.join(this.BACKUP_DIR, 'mongodb', filename);

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'mongodb',
      timestamp,
      size: 0,
      status: 'in_progress',
      path: backupPath
    };

    this.backupHistory.push(metadata);

    try {
      logger.info('Starting MongoDB backup', { backupId, path: backupPath });

      // Extract database name from MongoDB URI
      const mongoUri = config.MONGODB_URI;
      const dbName = this.extractDatabaseName(mongoUri);

      // Create mongodump command
      const dumpCommand = this.backupConfig.mongodb.compression
        ? `mongodump --uri="${mongoUri}" --db="${dbName}" --archive="${backupPath}" --gzip`
        : `mongodump --uri="${mongoUri}" --db="${dbName}" --archive="${backupPath}"`;

      // Execute backup
      const { stdout, stderr } = await execAsync(dumpCommand);

      if (stderr && !stderr.includes('done dumping')) {
        throw new Error(`MongoDB backup failed: ${stderr}`);
      }

      // Get file size
      const stats = await fs.stat(backupPath);
      metadata.size = stats.size;
      metadata.status = 'success';

      // Generate checksum
      metadata.checksum = await this.generateChecksum(backupPath);

      logger.info('MongoDB backup completed successfully', {
        backupId,
        size: `${(metadata.size / 1024 / 1024).toFixed(2)} MB`,
        checksum: metadata.checksum
      });

      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;

      logger.error('MongoDB backup failed', {
        backupId,
        error: error.message
      });

      // Clean up failed backup file
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        logger.warn('Failed to clean up failed backup file', {
          backupId,
          path: backupPath,
          error: cleanupError.message
        });
      }

      throw error;
    }
  }

  /**
   * Create files backup
   */
  async createFilesBackup(): Promise<BackupMetadata> {
    const backupId = `files_${Date.now()}`;
    const timestamp = new Date();
    const filename = `${backupId}.tar.gz`;
    const backupPath = path.join(this.BACKUP_DIR, 'files', filename);

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'files',
      timestamp,
      size: 0,
      status: 'in_progress',
      path: backupPath
    };

    this.backupHistory.push(metadata);

    try {
      logger.info('Starting files backup', { backupId, directories: this.backupConfig.files.directories });

      // Create tar command for specified directories
      const directories = this.backupConfig.files.directories
        .filter(dir => this.directoryExists(dir))
        .join(' ');

      if (!directories) {
        throw new Error('No valid directories found for backup');
      }

      const tarCommand = `tar -czf "${backupPath}" ${directories}`;

      // Execute backup
      const { stdout, stderr } = await execAsync(tarCommand);

      if (stderr) {
        logger.warn('Files backup completed with warnings', { backupId, warnings: stderr });
      }

      // Get file size
      const stats = await fs.stat(backupPath);
      metadata.size = stats.size;
      metadata.status = 'success';

      // Generate checksum
      metadata.checksum = await this.generateChecksum(backupPath);

      logger.info('Files backup completed successfully', {
        backupId,
        size: `${(metadata.size / 1024 / 1024).toFixed(2)} MB`,
        checksum: metadata.checksum
      });

      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;

      logger.error('Files backup failed', {
        backupId,
        error: error.message
      });

      // Clean up failed backup file
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        logger.warn('Failed to clean up failed backup file', {
          backupId,
          path: backupPath,
          error: cleanupError.message
        });
      }

      throw error;
    }
  }

  /**
   * Create full backup (MongoDB + Files)
   */
  async createFullBackup(): Promise<{ mongodb: BackupMetadata; files: BackupMetadata }> {
    logger.info('Starting full backup');

    try {
      const [mongoBackup, filesBackup] = await Promise.all([
        this.createMongoDBBackup(),
        this.createFilesBackup()
      ]);

      logger.info('Full backup completed successfully', {
        mongodb: mongoBackup.id,
        files: filesBackup.id,
        totalSize: `${((mongoBackup.size + filesBackup.size) / 1024 / 1024).toFixed(2)} MB`
      });

      return { mongodb: mongoBackup, files: filesBackup };

    } catch (error) {
      logger.error('Full backup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Restore MongoDB backup
   */
  async restoreMongoDBBackup(backupId: string): Promise<void> {
    const backup = this.backupHistory.find(b => b.id === backupId && b.type === 'mongodb');
    
    if (!backup) {
      throw new Error(`MongoDB backup not found: ${backupId}`);
    }

    if (backup.status !== 'success') {
      throw new Error(`Cannot restore failed backup: ${backupId}`);
    }

    try {
      logger.info('Starting MongoDB restore', { backupId, path: backup.path });

      // Verify backup file exists
      await fs.access(backup.path);

      // Extract database name from MongoDB URI
      const mongoUri = config.MONGODB_URI;
      const dbName = this.extractDatabaseName(mongoUri);

      // Create mongorestore command
      const restoreCommand = `mongorestore --uri="${mongoUri}" --db="${dbName}" --archive="${backup.path}" --gzip --drop`;

      // Execute restore
      const { stdout, stderr } = await execAsync(restoreCommand);

      if (stderr && !stderr.includes('done')) {
        throw new Error(`MongoDB restore failed: ${stderr}`);
      }

      logger.info('MongoDB restore completed successfully', { backupId });

    } catch (error) {
      logger.error('MongoDB restore failed', { backupId, error: error.message });
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const now = new Date();
      
      // Clean up MongoDB backups
      const mongoRetentionDate = new Date(now.getTime() - this.backupConfig.mongodb.retention * 24 * 60 * 60 * 1000);
      const oldMongoBackups = this.backupHistory.filter(
        b => b.type === 'mongodb' && b.timestamp < mongoRetentionDate
      );

      // Clean up file backups
      const filesRetentionDate = new Date(now.getTime() - this.backupConfig.files.retention * 24 * 60 * 60 * 1000);
      const oldFileBackups = this.backupHistory.filter(
        b => b.type === 'files' && b.timestamp < filesRetentionDate
      );

      const oldBackups = [...oldMongoBackups, ...oldFileBackups];

      for (const backup of oldBackups) {
        try {
          await fs.unlink(backup.path);
          this.backupHistory = this.backupHistory.filter(b => b.id !== backup.id);
          
          logger.info('Old backup cleaned up', {
            backupId: backup.id,
            type: backup.type,
            age: Math.floor((now.getTime() - backup.timestamp.getTime()) / (24 * 60 * 60 * 1000))
          });
        } catch (error) {
          logger.warn('Failed to clean up old backup', {
            backupId: backup.id,
            path: backup.path,
            error: error.message
          });
        }
      }

      logger.info('Backup cleanup completed', { cleanedUp: oldBackups.length });

    } catch (error) {
      logger.error('Backup cleanup failed', { error: error.message });
    }
  }

  /**
   * Get backup status and history
   */
  getBackupStatus(): {
    config: BackupConfig;
    history: BackupMetadata[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      totalSize: number;
      lastBackup?: Date;
    };
  } {
    const successful = this.backupHistory.filter(b => b.status === 'success');
    const failed = this.backupHistory.filter(b => b.status === 'failed');
    const totalSize = successful.reduce((sum, b) => sum + b.size, 0);
    const lastBackup = this.backupHistory.length > 0 
      ? this.backupHistory[this.backupHistory.length - 1].timestamp 
      : undefined;

    return {
      config: this.backupConfig,
      history: this.backupHistory.slice(-20), // Last 20 backups
      summary: {
        total: this.backupHistory.length,
        successful: successful.length,
        failed: failed.length,
        totalSize,
        lastBackup
      }
    };
  }

  /**
   * Helper methods
   */
  private extractDatabaseName(mongoUri: string): string {
    try {
      const url = new URL(mongoUri);
      return url.pathname.substring(1).split('?')[0] || 'lajospaces';
    } catch {
      return 'lajospaces';
    }
  }

  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async generateChecksum(filePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`sha256sum "${filePath}"`);
      return stdout.split(' ')[0];
    } catch {
      return 'unknown';
    }
  }
}

// Create singleton instance
export const backupService = new BackupService();

export default backupService;
