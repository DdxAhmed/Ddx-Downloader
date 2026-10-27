export interface ShutdownActions {
  hasActiveWork(): boolean;
  confirmInterruption(): Promise<boolean>;
  pauseQueue(): void;
  stopProcesses(): Promise<void>;
  flushDatabase(): void;
  recover(): void;
}

/** Shared by explicit restart and normal app exit; never installs or exits by itself. */
export class ShutdownCoordinator {
  private pending?: Promise<boolean>;
  public ready = false;
  constructor(private actions: ShutdownActions) {}
  public reset(): void { this.ready = false; this.actions.recover(); }

  public prepare(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true);
    if (this.pending) return this.pending;
    this.pending = this.run().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async run(): Promise<boolean> {
    if (this.actions.hasActiveWork() && !await this.actions.confirmInterruption()) return false;
    let paused = false;
    try {
      // Fail before disturbing live work if the database is already unwritable.
      this.actions.flushDatabase();
      this.actions.pauseQueue();
      paused = true;
      // Persist before and after terminating children. Do not quit on persistence failure.
      this.actions.flushDatabase();
      await this.actions.stopProcesses();
      this.actions.flushDatabase();
      this.ready = true;
      return true;
    } catch (error) {
      // Once callbacks have been invalidated, do not leave media running unseen.
      if (paused) {
        try { await this.actions.stopProcesses(); } catch { /* keep shutdown blocked */ }
      }
      this.actions.recover();
      throw error;
    }
  }
}
