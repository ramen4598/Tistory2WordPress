export enum MigrationJobType {
  FULL = 'full',
  SINGLE = 'single',
  RETRY = 'retry',
}

export enum MigrationJobStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum MigrationJobItemStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ImageAssetStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  FAILED = 'failed',
}
