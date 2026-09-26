'use strict';

/**
 * Notification delivery is intentionally separate from notification policy.
 *
 * Controllers decide which event happened and which recipients should receive
 * it. This module only selects a channel and delegates delivery to that
 * channel's adapter. Adding SMS or in-app delivery therefore does not require
 * changing request or monument workflow code.
 */

const CHANNELS = Object.freeze({
  EMAIL: 'email',
  SMS: 'sms',
  IN_APP: 'in_app',
});

const NOTIFICATION_EVENTS = Object.freeze({
  REQUEST_SUBMITTED: 'request.submitted',
  REQUEST_STATUS_CHANGED: 'request.status_changed',
  MONUMENT_SETTING_STATUS_CHANGED: 'monument_setting.status_changed',
  INVOICE_CREATED: 'invoice.created',
  TEAM_MEMBER_STATUS_CHANGED: 'team_member.status_changed',
});



const DEFAULT_CHANNELS = Object.freeze([CHANNELS.EMAIL]);

const configuredDefaultChannels = () => {
  const configured = String(process.env.NOTIFICATION_CHANNELS || '').trim();
  if (!configured) return [...DEFAULT_CHANNELS];

  const channels = configured
    .split(',')
    .map((channel) => channel.trim().toLowerCase())
    .filter(Boolean);

  return channels.length ? [...new Set(channels)] : [...DEFAULT_CHANNELS];
};

const recipientEmail = (recipient) => {
  if (typeof recipient === 'string') return recipient;
  return recipient?.email || recipient?.address || null;
};

const recipientName = (recipient) => {
  if (typeof recipient === 'string') return undefined;
  return recipient?.name || recipient?.contactName || recipient?.username;
};

const buildEmailSender = (emailService) => async (event, recipient) => {
  const payload = event.payload || event.data || {};
  const email = recipientEmail(recipient);
  if (!email) throw new Error('An email recipient address is required.');
  const common = {
    ...payload,
    recipientEmail: email,
    recipientName: recipientName(recipient) || payload.recipientName,
  };

  switch (event.type) {
    case NOTIFICATION_EVENTS.REQUEST_SUBMITTED:
      return emailService.sendRequestSubmittedEmail(common);
    case NOTIFICATION_EVENTS.REQUEST_STATUS_CHANGED:
      return emailService.sendRequestStatusUpdateEmail(common);
    case NOTIFICATION_EVENTS.MONUMENT_SETTING_STATUS_CHANGED:
      if (String(payload.status || '').toLowerCase() === 'completed') {
        return emailService.sendMonumentCompletionEmail(common);
      }
      return emailService.sendMonumentSettingStatusUpdateEmail(common);
      case NOTIFICATION_EVENTS.INVOICE_CREATED:
      return emailService.sendApInvoiceEmail(common);
    case NOTIFICATION_EVENTS.TEAM_MEMBER_STATUS_CHANGED:
      return emailService.sendTeamMemberStatusUpdateEmail(common);
    default:
      throw new Error(`Email delivery does not support event: ${event.type}`);
  }
};

const createNotificationService = ({
  channels = {},
  defaultChannels = configuredDefaultChannels(),
} = {}) => {
  // Require lazily so tests and future adapters can inject their own channel
  // implementation without importing or configuring an email provider.
  const emailService = channels.email || require('../emailService');
  const senders = new Map([
    [CHANNELS.EMAIL, buildEmailSender(emailService)],
  ]);

  for (const [channel, sender] of Object.entries(channels)) {
    if (channel !== CHANNELS.EMAIL && typeof sender === 'function') {
      senders.set(channel, sender);
    }
  }

  const registerChannel = (channel, sender) => {
    const normalizedChannel = String(channel || '').trim().toLowerCase();
    if (!normalizedChannel || typeof sender !== 'function') {
      throw new TypeError('A channel name and sender function are required.');
    }
    senders.set(normalizedChannel, sender);
    return api;
  };

  const sendNotification = async (event, recipient, channel) => {
    if (!event?.type) throw new TypeError('A notification event type is required.');
    if (!recipient) throw new Error('A notification recipient is required.');

    const selectedChannel = String(
      channel || event.channel || defaultChannels[0] || CHANNELS.EMAIL,
    ).trim().toLowerCase();
    const sender = senders.get(selectedChannel);
    if (!sender) {
      throw new Error(`Notification channel is not configured: ${selectedChannel}`);
    }

    return sender(event, recipient);
  };

  const sendNotifications = async (event, recipients, channel) => {
    const list = Array.isArray(recipients) ? recipients : [];
    return Promise.allSettled(list.map((recipient) => (
      sendNotification(event, recipient, channel)
    )));
  };

  const api = {
    sendNotification,
    sendNotifications,
    registerChannel,
    getChannels: () => [...senders.keys()],
  };

  return api;
};

const defaultNotificationService = createNotificationService();

module.exports = {
  CHANNELS,
  NOTIFICATION_EVENTS,
  DEFAULT_CHANNELS,
  createNotificationService,
  sendNotification: (...args) => defaultNotificationService.sendNotification(...args),
  sendNotifications: (...args) => defaultNotificationService.sendNotifications(...args),
};