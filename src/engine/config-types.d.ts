import { Setting } from './config.js';
import type { Event } from './general/events-types';

type SettingChangeEvent = Event<'settingchange', [setting: Setting, current: Setting['value'], previous: Setting['value']]>;

export type ConfigEvent = SettingChangeEvent;
