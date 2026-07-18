import { Queue } from 'bullmq';
import { getRedisConnection } from '../../config/marketingRedis';

const connection = getRedisConnection();

export const campaignDispatchQueue = new Queue('campaign-dispatch-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  },
});

export const messageDeliveryQueue = new Queue('message-delivery-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: true,
  },
});

export const automationTriggerQueue = new Queue('automation-trigger-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});
