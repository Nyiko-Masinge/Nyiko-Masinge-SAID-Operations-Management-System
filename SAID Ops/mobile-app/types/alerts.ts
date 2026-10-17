import type { ComponentProps } from 'react';

import type { Ionicons } from '@expo/vector-icons';

export type AlertCategory = 'high' | 'info' | 'system';
export type AlertFilter = 'all' | AlertCategory;
export type AlertAction = 'home' | 'roster' | 'taskDetail';
export type AlertIcon = ComponentProps<typeof Ionicons>['name'];

export type DemoAlert = {
  action?: AlertAction;
  category: AlertCategory;
  icon: AlertIcon;
  id: string;
  message: string;
  read: boolean;
  time: string;
  title: string;
};
