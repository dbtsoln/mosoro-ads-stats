import cron from 'node-cron';
import { logger } from './logger.js';

export class Scheduler {
  private tasks: cron.ScheduledTask[] = [];

  schedule(
    intervalMinutes: number,
    callback: () => Promise<void>,
    taskName: string,
    runImmediately: boolean = true,
    atSecond: number = 30
  ): void {
    // Run at :30 seconds of each minute to avoid VK API timestamp inconsistencies
    const cronExpression = `${atSecond} */${intervalMinutes} * * * *`;

    logger.info(`Scheduling task: ${taskName}`, {
      interval: `${intervalMinutes} minutes at :${atSecond} seconds`,
      cronExpression,
      runImmediately,
    });

    const task = cron.schedule(
      cronExpression,
      async () => {
        try {
          logger.debug(`Running scheduled task: ${taskName}`);
          await callback();
        } catch (error) {
          logger.error(`Scheduled task failed: ${taskName}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        scheduled: true,
        runOnInit: runImmediately,
      }
    );

    this.tasks.push(task);
  }

  stopAll(): void {
    logger.info('Stopping all scheduled tasks');
    this.tasks.forEach((task) => task.stop());
    this.tasks = [];
  }
}
