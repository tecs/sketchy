import { Setting, BooleanSetting, NumberSetting, StringSetting } from './config.js';
import type { EventType, MergedEvent } from './events-types';

type SettingEventType<T extends Setting> = EventType<'settingchange', [setting: T, current: T['value'], previous: T['value']]>;

export type ConfigEvent = MergedEvent<
  SettingEventType<BooleanSetting>
  | SettingEventType<StringSetting>
  | SettingEventType<NumberSetting>
>;
