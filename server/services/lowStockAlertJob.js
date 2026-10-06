import cron from 'node-cron';
import { runLowStockAlertCheck } from './lowStockAlertService.js';

// Off by default: a fresh checkout of this project has no SMTP
// credentials configured, and a class/demo environment shouldn't silently
// start emailing on a schedule. Set ENABLE_LOW_STOCK_ALERTS=true (and the
// SMTP_* vars) in server/.env to turn it on.
export function startLowStockAlertJob() {
  if (process.env.ENABLE_LOW_STOCK_ALERTS !== 'true') {
    console.log('[lowStockAlertJob] Disabled (set ENABLE_LOW_STOCK_ALERTS=true to enable).');
    return;
  }

  // Defaults to once a day at 8:00 AM server time.
  const schedule = process.env.LOW_STOCK_ALERT_CRON || '0 8 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[lowStockAlertJob] Invalid LOW_STOCK_ALERT_CRON expression: "${schedule}" — job not started.`);
    return;
  }

  cron.schedule(schedule, async () => {
    try {
      const result = await runLowStockAlertCheck();
      console.log('[lowStockAlertJob] Check complete:', result);
    } catch (err) {
      console.error('[lowStockAlertJob] Failed:', err.message);
    }
  });

  console.log(`[lowStockAlertJob] Scheduled with cron expression "${schedule}".`);
}
