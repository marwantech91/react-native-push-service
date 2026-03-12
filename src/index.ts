import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';

const { PushNotificationModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(PushNotificationModule);

type PermissionStatus = 'granted' | 'denied' | 'not_determined';
type Importance = 'none' | 'min' | 'low' | 'default' | 'high';
type RepeatType = 'minute' | 'hour' | 'day' | 'week';

interface Notification {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
  category?: string;
  channelId?: string;
  sound?: string;
  badge?: number;
}

interface ScheduleOptions extends Notification {
  fireDate: Date;
  repeat?: RepeatType;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  importance?: Importance;
  sound?: string;
  vibration?: boolean;
  lights?: boolean;
  lightColor?: string;
}

interface Action {
  id: string;
  title: string;
  input?: boolean;
  destructive?: boolean;
}

interface Category {
  id: string;
  actions: Action[];
}

interface ActionEvent {
  id: string;
  input?: string;
}

interface PermissionOptions {
  alert?: boolean;
  badge?: boolean;
  sound?: boolean;
  provisional?: boolean;
  criticalAlert?: boolean;
}

type NotificationHandler = (notification: Notification) => void;
type TokenHandler = (token: string) => void;
type ActionHandler = (action: ActionEvent, notification: Notification) => void;

export class PushService {
  private token: string | null = null;
  private notificationHandlers: NotificationHandler[] = [];
  private openedHandlers: NotificationHandler[] = [];
  private tokenHandlers: TokenHandler[] = [];
  private actionHandlers: ActionHandler[] = [];
  private backgroundHandler: ((notification: Notification) => Promise<void>) | null = null;
  private subscriptions: any[] = [];

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    // Foreground notification
    this.subscriptions.push(
      eventEmitter.addListener('onNotification', (notification: Notification) => {
        this.notificationHandlers.forEach(handler => handler(notification));
      })
    );

    // Notification opened (tapped)
    this.subscriptions.push(
      eventEmitter.addListener('onNotificationOpened', (notification: Notification) => {
        this.openedHandlers.forEach(handler => handler(notification));
      })
    );

    // Token refresh
    this.subscriptions.push(
      eventEmitter.addListener('onTokenRefresh', (token: string) => {
        this.token = token;
        this.tokenHandlers.forEach(handler => handler(token));
      })
    );

    // Action pressed
    this.subscriptions.push(
      eventEmitter.addListener('onAction', (event: { action: ActionEvent; notification: Notification }) => {
        this.actionHandlers.forEach(handler => handler(event.action, event.notification));
      })
    );

    // Background notification
    this.subscriptions.push(
      eventEmitter.addListener('onBackgroundNotification', async (notification: Notification) => {
        if (this.backgroundHandler) {
          await this.backgroundHandler(notification);
        }
      })
    );
  }

  async requestPermission(options: PermissionOptions = {}): Promise<PermissionStatus> {
    const config = {
      alert: options.alert ?? true,
      badge: options.badge ?? true,
      sound: options.sound ?? true,
      provisional: options.provisional ?? false,
      criticalAlert: options.criticalAlert ?? false,
    };

    try {
      const result = await PushNotificationModule.requestPermission(config);
      return result as PermissionStatus;
    } catch {
      return 'denied';
    }
  }

  async checkPermission(): Promise<PermissionStatus> {
    try {
      return await PushNotificationModule.checkPermission();
    } catch {
      return 'not_determined';
    }
  }

  async openSettings(): Promise<void> {
    await PushNotificationModule.openSettings();
  }

  async getToken(): Promise<string | null> {
    if (this.token) return this.token;

    try {
      this.token = await PushNotificationModule.getToken();
      return this.token;
    } catch {
      return null;
    }
  }

  async getInitialNotification(): Promise<Notification | null> {
    try {
      return await PushNotificationModule.getInitialNotification();
    } catch {
      return null;
    }
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.push(handler);
    return () => {
      this.notificationHandlers = this.notificationHandlers.filter(h => h !== handler);
    };
  }

  onNotificationOpened(handler: NotificationHandler): () => void {
    this.openedHandlers.push(handler);
    return () => {
      this.openedHandlers = this.openedHandlers.filter(h => h !== handler);
    };
  }

  onTokenRefresh(handler: TokenHandler): () => void {
    this.tokenHandlers.push(handler);
    return () => {
      this.tokenHandlers = this.tokenHandlers.filter(h => h !== handler);
    };
  }

  onAction(handler: ActionHandler): () => void {
    this.actionHandlers.push(handler);
    return () => {
      this.actionHandlers = this.actionHandlers.filter(h => h !== handler);
    };
  }

  setBackgroundHandler(handler: (notification: Notification) => Promise<void>): void {
    this.backgroundHandler = handler;
  }

  // Local Notifications
  async localNotification(notification: Notification): Promise<string> {
    const id = notification.id || this.generateId();
    await PushNotificationModule.presentLocalNotification({
      ...notification,
      id,
    });
    return id;
  }

  async scheduleNotification(options: ScheduleOptions): Promise<string> {
    const id = options.id || this.generateId();
    await PushNotificationModule.scheduleLocalNotification({
      ...options,
      id,
      fireDate: options.fireDate.getTime(),
    });
    return id;
  }

  async cancelNotification(id: string): Promise<void> {
    await PushNotificationModule.cancelLocalNotification(id);
  }

  async cancelAllNotifications(): Promise<void> {
    await PushNotificationModule.cancelAllLocalNotifications();
  }

  async getScheduledNotifications(): Promise<ScheduleOptions[]> {
    return PushNotificationModule.getScheduledLocalNotifications();
  }

  // Topics
  async subscribeToTopic(topic: string): Promise<void> {
    await PushNotificationModule.subscribeToTopic(topic);
  }

  async unsubscribeFromTopic(topic: string): Promise<void> {
    await PushNotificationModule.unsubscribeFromTopic(topic);
  }

  async getSubscribedTopics(): Promise<string[]> {
    return PushNotificationModule.getSubscribedTopics();
  }

  // Badge
  async setBadgeCount(count: number): Promise<void> {
    await PushNotificationModule.setBadgeCount(count);
  }

  async getBadgeCount(): Promise<number> {
    return PushNotificationModule.getBadgeCount();
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  // Channels (Android)
  async createChannel(channel: Channel): Promise<void> {
    if (Platform.OS !== 'android') return;
    await PushNotificationModule.createChannel(channel);
  }

  async deleteChannel(channelId: string): Promise<void> {
    if (Platform.OS !== 'android') return;
    await PushNotificationModule.deleteChannel(channelId);
  }

  async getChannels(): Promise<Channel[]> {
    if (Platform.OS !== 'android') return [];
    return PushNotificationModule.getChannels();
  }

  // Categories & Actions
  setNotificationCategories(categories: Category[]): void {
    PushNotificationModule.setNotificationCategories(categories);
  }

  // Cleanup
  destroy(): void {
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions = [];
    this.notificationHandlers = [];
    this.openedHandlers = [];
    this.tokenHandlers = [];
    this.actionHandlers = [];
    this.backgroundHandler = null;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// React Hook
interface UsePushNotificationsOptions {
  onNotification?: NotificationHandler;
  onNotificationOpened?: NotificationHandler;
  onTokenRefresh?: TokenHandler;
  onAction?: ActionHandler;
  requestOnMount?: boolean;
}

interface UsePushNotificationsResult {
  token: string | null;
  permission: PermissionStatus;
  notification: Notification | null;
  requestPermission: () => Promise<PermissionStatus>;
  setBadge: (count: number) => Promise<void>;
  subscribeToTopic: (topic: string) => Promise<void>;
  unsubscribeFromTopic: (topic: string) => Promise<void>;
  localNotification: (notification: Notification) => Promise<string>;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsResult {
  const pushRef = useRef<PushService>();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionStatus>('not_determined');
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => {
    const push = new PushService();
    pushRef.current = push;

    // Setup handlers
    const unsubNotification = push.onNotification((n) => {
      setNotification(n);
      options.onNotification?.(n);
    });

    const unsubOpened = push.onNotificationOpened((n) => {
      options.onNotificationOpened?.(n);
    });

    const unsubToken = push.onTokenRefresh((t) => {
      setToken(t);
      options.onTokenRefresh?.(t);
    });

    if (options.onAction) {
      push.onAction(options.onAction);
    }

    // Check initial state
    push.checkPermission().then(setPermission);
    push.getToken().then(setToken);
    push.getInitialNotification().then((n) => {
      if (n) {
        setNotification(n);
        options.onNotificationOpened?.(n);
      }
    });

    // Auto-request permission
    if (options.requestOnMount) {
      push.requestPermission().then(setPermission);
    }

    return () => {
      unsubNotification();
      unsubOpened();
      unsubToken();
      push.destroy();
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await pushRef.current!.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const setBadge = useCallback(async (count: number) => {
    await pushRef.current!.setBadgeCount(count);
  }, []);

  const subscribeToTopic = useCallback(async (topic: string) => {
    await pushRef.current!.subscribeToTopic(topic);
  }, []);

  const unsubscribeFromTopic = useCallback(async (topic: string) => {
    await pushRef.current!.unsubscribeFromTopic(topic);
  }, []);

  const localNotification = useCallback(async (n: Notification) => {
    return pushRef.current!.localNotification(n);
  }, []);

  return {
    token,
    permission,
    notification,
    requestPermission,
    setBadge,
    subscribeToTopic,
    unsubscribeFromTopic,
    localNotification,
  };
}

export default PushService;
export type {
  Notification,
  ScheduleOptions,
  Channel,
  Category,
  Action,
  PermissionStatus,
  PermissionOptions,
};
