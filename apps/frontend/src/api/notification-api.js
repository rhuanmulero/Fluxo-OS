import { api } from '../core/api-client.js';

export class NotificationApi {
  constructor(client = api) {
    this.client = client;
  }

  list(unreadOnly = false) {
    return this.client.get(`/me/notifications?unreadOnly=${unreadOnly}`);
  }

  markRead(id) {
    return this.client.patch(`/me/notifications/${id}/read`, {});
  }

  markAllRead() {
    return this.client.patch('/me/notifications/read-all', {});
  }
}

export const notificationApi = new NotificationApi();
