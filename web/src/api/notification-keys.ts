export const notificationKeys = {
  all: ['notifications'] as const,
  page: (page: number) => ['notifications', page] as const,
}
