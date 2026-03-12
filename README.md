# React Native Push Service

![React Native](https://img.shields.io/badge/React_Native-0.72-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

Unified push notification service for React Native. Supports FCM, APNs, local notifications, topics, and scheduling.

## Features

- **FCM & APNs** - Firebase Cloud Messaging & Apple Push
- **Local Notifications** - Schedule without server
- **Topics** - Subscribe to channels
- **Badges** - App icon badge management
- **Deep Links** - Handle notification taps
- **Background** - Process in background
- **Rich Media** - Images, actions, categories

## Installation

```bash
npm install @marwantech/react-native-push-service
```

### iOS Setup

```bash
cd ios && pod install
```

Enable Push Notifications capability in Xcode.

### Android Setup

Add `google-services.json` to `android/app/`.

```gradle
// android/build.gradle
classpath 'com.google.gms:google-services:4.3.15'

// android/app/build.gradle
apply plugin: 'com.google.gms.google-services'
```

## Quick Start

```typescript
import { PushService } from '@marwantech/react-native-push-service';

const push = new PushService();

// Request permission
const granted = await push.requestPermission();

// Get device token
const token = await push.getToken();
console.log('FCM Token:', token);

// Listen for notifications
push.onNotification((notification) => {
  console.log('Received:', notification);
});

// Listen for token refresh
push.onTokenRefresh((newToken) => {
  // Update token on your server
  api.updatePushToken(newToken);
});
```

## Permissions

```typescript
// Check current status
const status = await push.checkPermission();
// 'granted' | 'denied' | 'not_determined'

// Request permission
const result = await push.requestPermission({
  alert: true,
  badge: true,
  sound: true,
  provisional: false,  // iOS: silent permission
  criticalAlert: false, // iOS: bypass DND
});

// Open settings if denied
if (result === 'denied') {
  push.openSettings();
}
```

## Handling Notifications

### Foreground

```typescript
push.onNotification((notification) => {
  console.log('Title:', notification.title);
  console.log('Body:', notification.body);
  console.log('Data:', notification.data);

  // Show in-app alert
  showInAppNotification(notification);
});
```

### Background

```typescript
// Register background handler (call early, outside component)
push.setBackgroundHandler(async (notification) => {
  console.log('Background notification:', notification);

  // Process data
  if (notification.data.type === 'new_message') {
    await syncMessages();
  }
});
```

### Notification Tap

```typescript
push.onNotificationOpened((notification) => {
  // User tapped the notification
  const { data } = notification;

  if (data.screen) {
    navigation.navigate(data.screen, data.params);
  }
});
```

### Initial Notification

```typescript
// Check if app was opened from notification
const initial = await push.getInitialNotification();
if (initial) {
  handleNotificationNavigation(initial);
}
```

## Local Notifications

```typescript
// Schedule immediately
await push.localNotification({
  title: 'Hello',
  body: 'This is a local notification',
  data: { screen: 'Home' },
});

// Schedule for later
await push.scheduleNotification({
  title: 'Reminder',
  body: 'Your meeting starts in 10 minutes',
  fireDate: new Date(Date.now() + 10 * 60 * 1000),
  data: { meetingId: '123' },
});

// Repeating notification
await push.scheduleNotification({
  id: 'daily-reminder',
  title: 'Daily Check-in',
  body: 'Time to log your progress',
  fireDate: new Date(),
  repeat: 'day', // 'minute' | 'hour' | 'day' | 'week'
});

// Cancel scheduled
await push.cancelNotification('daily-reminder');
await push.cancelAllNotifications();
```

## Topics (Channels)

```typescript
// Subscribe to topic
await push.subscribeToTopic('news');
await push.subscribeToTopic('deals');

// Unsubscribe
await push.unsubscribeFromTopic('deals');

// Get subscribed topics
const topics = await push.getSubscribedTopics();
// ['news']
```

## Badges

```typescript
// Set badge count
await push.setBadgeCount(5);

// Get current count
const count = await push.getBadgeCount();

// Clear badge
await push.setBadgeCount(0);
// or
await push.clearBadge();
```

## Notification Channels (Android)

```typescript
// Create channel
await push.createChannel({
  id: 'messages',
  name: 'Messages',
  description: 'Chat message notifications',
  importance: 'high',  // 'none' | 'min' | 'low' | 'default' | 'high'
  sound: 'message.mp3',
  vibration: true,
  lights: true,
  lightColor: '#FF0000',
});

// Delete channel
await push.deleteChannel('messages');

// List channels
const channels = await push.getChannels();
```

## Rich Notifications

### Images

```typescript
await push.localNotification({
  title: 'New Photo',
  body: 'Check out this image',
  imageUrl: 'https://example.com/photo.jpg',
});
```

### Actions

```typescript
// Define action categories
push.setNotificationCategories([
  {
    id: 'MESSAGE',
    actions: [
      { id: 'reply', title: 'Reply', input: true },
      { id: 'mark_read', title: 'Mark as Read' },
    ],
  },
  {
    id: 'APPROVAL',
    actions: [
      { id: 'approve', title: 'Approve', destructive: false },
      { id: 'reject', title: 'Reject', destructive: true },
    ],
  },
]);

// Handle action press
push.onAction((action, notification) => {
  console.log('Action:', action.id);
  console.log('Input:', action.input); // For reply actions

  if (action.id === 'reply') {
    sendReply(notification.data.messageId, action.input);
  }
});

// Send notification with category
await push.localNotification({
  title: 'New Message',
  body: 'Hey, how are you?',
  category: 'MESSAGE',
  data: { messageId: '123' },
});
```

## React Hook

```typescript
import { usePushNotifications } from '@marwantech/react-native-push-service';

function App() {
  const {
    token,
    permission,
    requestPermission,
    notification,
  } = usePushNotifications({
    onNotification: (n) => console.log('Received:', n),
    onTokenRefresh: (t) => api.updateToken(t),
  });

  useEffect(() => {
    if (notification) {
      handleNotification(notification);
    }
  }, [notification]);

  return (
    <View>
      <Text>Permission: {permission}</Text>
      <Text>Token: {token?.substring(0, 20)}...</Text>
    </View>
  );
}
```

## Server Integration

### Send to Token

```typescript
// Your backend
const message = {
  token: 'device_fcm_token',
  notification: {
    title: 'Hello',
    body: 'World',
  },
  data: {
    screen: 'Profile',
    userId: '123',
  },
};

await admin.messaging().send(message);
```

### Send to Topic

```typescript
const message = {
  topic: 'news',
  notification: {
    title: 'Breaking News',
    body: 'Something happened',
  },
};

await admin.messaging().send(message);
```

## API Reference

```typescript
interface Notification {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
  category?: string;
  channelId?: string; // Android
  sound?: string;
  badge?: number;
}

interface ScheduleOptions extends Notification {
  fireDate: Date;
  repeat?: 'minute' | 'hour' | 'day' | 'week';
}

type PermissionStatus = 'granted' | 'denied' | 'not_determined';
```

## License

MIT
