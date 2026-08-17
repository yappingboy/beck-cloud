import { createFileRoute } from '@tanstack/react-router';
import SettingsView from '@/views/SettingsView';

export const Route = createFileRoute('/_layout/_auth/settings')({
  component: SettingsView,
});
