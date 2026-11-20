// Browser pilot uses the durable Inbox and foreground refresh. Native Firebase
// is deliberately absent from the web bundle; browser push is not configured.
export const getMessaging = () => null;
export const setBackgroundMessageHandler = (_client: unknown, _handler: () => Promise<void>) => {};
export const onMessage = (_client: unknown, _handler: () => void) => () => {};
export const onNotificationOpenedApp = (_client: unknown, _handler: (message: { data?: Record<string, string> }) => void) => () => {};
export const getInitialNotification = async (_client: unknown): Promise<{ data?: Record<string, string> } | null> => null;
