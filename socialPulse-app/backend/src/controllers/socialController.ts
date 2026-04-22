import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { SocialAccountModel } from '../models/SocialAccount';
import { ScheduleModel } from '../models/Schedule';
import { addAIJob } from '../services/queue.service';

export const getConnectedAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const accounts = await SocialAccountModel.findByUser(req.user!.userId);
    res.json(accounts);
  } catch (err) {
    console.error('Get accounts error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const disconnectAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  const { platform } = req.params;
  try {
    await SocialAccountModel.disconnect(req.user!.userId, platform);
    res.status(204).send();
  } catch (err) {
    console.error('Disconnect error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getScheduledPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedules = await ScheduleModel.findByUser(req.user!.userId);
    res.json(schedules);
  } catch (err) {
    console.error('Get schedules error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const schedulePost = async (req: AuthRequest, res: Response): Promise<void> => {
  const { postId, platform, scheduledAt } = req.body;
  const userId = req.user!.userId;

  try {
    const account = await SocialAccountModel.findByUserAndPlatform(userId, platform);
    if (!account) {
      res.status(400).json({ message: `No connected ${platform} account` });
      return;
    }

    const schedule = await ScheduleModel.create({
      post_id: postId,
      user_id: userId,
      platform,
      scheduled_at: new Date(scheduledAt),
    });

    await addAIJob('schedule-post', {
      scheduleId: schedule.id,
      postId,
      platform,
      scheduledAt,
    });

    res.status(201).json(schedule);
  } catch (err) {
    console.error('Schedule post error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const cancelSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await ScheduleModel.cancel(id, req.user!.userId);
    res.status(204).send();
  } catch (err) {
    console.error('Cancel schedule error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
