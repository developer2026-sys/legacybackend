'use strict';

const cron = require('node-cron');
const { Partner, PartnershipSettings, Admin, TeamMember } = require('./models');
const { sendDailyReminderEmail } = require('./emailService');
const { calculatePartnerStats } = require('./partnerStatsService');

let cronJob = null;

const getRecipientEmails = async () => {
  const admins = await Admin.findAll({
    where: { emailRemindersEnabled: true },
    attributes: ['email'],
  });

  const teamMembers = await TeamMember.findAll({
    include: {
      association: 'admin',
      attributes: ['email'],
      where: { emailRemindersEnabled: true },
      required: true,
    },
  });

  return [
    ...new Set([
      ...admins.map((a) => a.email),
      ...teamMembers.map((t) => t.admin?.email).filter(Boolean),
    ]),
  ];
};

const sendDailyReminders = async () => {
  console.log(`[${new Date().toISOString()}] Starting daily reminder job...`);

  try {
    const partnersWithSettings = await Partner.findAll({
      include: {
        association: 'partnershipSettings',
        where: { emailRemindersEnabled: true },
        required: true,
      },
    });

    console.log(`Found ${partnersWithSettings.length} partners to send reminders for`);

    if (partnersWithSettings.length === 0) {
      console.log('No partners with email reminders enabled');
      return;
    }

    const recipientEmails = await getRecipientEmails();

    console.log(`Sending to ${recipientEmails.length} recipients:`, recipientEmails);
    for (const partner of partnersWithSettings) {
      try {
        const stats = await calculatePartnerStats(partner.id);

        for (const email of recipientEmails) {
          await sendDailyReminderEmail(email, stats.partnerName, stats);
        }

        await PartnershipSettings.update(
          { lastReminderSentDate: new Date() },
          { where: { partnerId: partner.id } }
        );

        console.log(`✓ Reminders sent for partner ${partner.id} to ${recipientEmails.length} recipients`);
      } catch (error) {
        console.error(`✗ Failed for partner ${partner.id}:`, error.message);
      }
    }

    console.log(`[${new Date().toISOString()}] Daily reminder job completed`);
  } catch (error) {
    console.error('Error in daily reminder job:', error);
  }
};

const initializeDailyReminderJob = () => {
  cronJob = cron.schedule('0 7 * * *', sendDailyReminders, {
    scheduled: true,
    timezone: 'America/Chicago',
  });
  console.log('✓ Daily reminder cron job initialized (runs daily at 7:00 AM)');
};

const stopDailyReminderJob = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('✓ Daily reminder cron job stopped');
  }
};

const triggerReminderNow = async (partnerId = null) => {
  console.log('Triggering reminder job manually...');

  if (partnerId) {
    try {
      const partner = await Partner.findByPk(partnerId, {
        include: { association: 'partnershipSettings' },
      });
      if (!partner) {
        console.error(`Partner ${partnerId} not found`);
        return;
      }

      if (partner.partnershipSettings && partner.partnershipSettings.emailRemindersEnabled === false) {
        console.log(`Partner ${partnerId} has email reminders disabled — skipping.`);
        return;
      }

      const stats = await calculatePartnerStats(partnerId);

      const recipientEmails = await getRecipientEmails();

      for (const email of recipientEmails) {
        await sendDailyReminderEmail(email, stats.partnerName, stats);
      }

      await PartnershipSettings.update(
        { lastReminderSentDate: new Date() },
        { where: { partnerId } }
      );

      console.log(`✓ Manual reminder sent for partner ${partnerId} to ${recipientEmails.length} recipients`);
    } catch (error) {
      console.error('Error sending manual reminder:', error);
      throw error;
    }
  } else {
    await sendDailyReminders();
  }
};

module.exports = {
  initializeDailyReminderJob,
  stopDailyReminderJob,
  sendDailyReminders,
  triggerReminderNow,
};