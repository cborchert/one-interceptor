import fs from 'fs';
import settings from 'electron-settings';

import _set from 'lodash/set';

import settingsNames from '../settingsNames';

// the path to the simulate host of the config from the local.json root
export const HOST_PATH = 'settings.api.simulateHost';
// the path to the useInterceptor config value from the local.json root
export const USE_INTERCEPTOR_PATH = 'settings.api.useInterceptor';

/**
 * Get the domains
 * @returns {Array} the domains
 */
export const getDomains = (featurebranchPath): Array<string> => {
  try {
    const domains = JSON.parse(fs.readFileSync(featurebranchPath, 'utf8'));
    if (!Array.isArray(domains)) {
      throw new Error(`"${featurebranchPath}" does not contain an array`);
    }
    return domains;
  } catch {
    console.log(
      `Unable to read domains array from JSON file at "${featurebranchPath}"`
    );
    return [];
  }
};

/**
 * Get a string from the user settings
 */
export const getStringFromSettings = (settingName): string => {
  const val = settings.getSync(settingName);
  return typeof val === 'string' ? val : '';
};

/**
 * Set the user's setting for a string val
 */
export const setStringToSettings = (settingName, val): string => {
  if (typeof val !== 'string') {
    settings.setSync(settingName, '');
    return '';
  }
  settings.setSync(settingName, val);
  return val;
};

/**
 * Get an array from the user settings
 */
export const getArrayFromSettings = (settingName: string): any => {
  const val = settings.getSync(settingName);
  return Array.isArray(val) ? val : [];
};

/**
 * Set the user's setting for the an array
 */
export const setArrayToSettings = (settingName, val) => {
  if (!Array.isArray(val)) {
    settings.setSync(settingName, []);
    return [];
  }
  settings.setSync(settingName, val);
  return val;
};

/**
 * Get the contents of the local.json config
 * @returns {Object} the local.config configuration
 */
export const getLocalConfig = (
  localConfigPath: string
): Record<string, any> => {
  try {
    const config = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
    if (typeof config !== 'object') {
      throw new Error(`"${localConfigPath}" does not contain an object`);
    }
    return config;
  } catch {
    console.log(
      `Unable to read config object from JSON file at "${localConfigPath}"`
    );
    return {};
  }
};

export const setLocalConfigProp = (
  localConfigPath: string,
  path: string,
  value: any
) => {
  try {
    const config = getLocalConfig(localConfigPath);
    _set(config, path, value);
    fs.writeFileSync(localConfigPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(
      `Updated config object at "${localConfigPath}". ${path} => ${value}`
    );
    return config;
  } catch {
    console.log(`Unable to update config object at "${localConfigPath}"`);
    return getLocalConfig(localConfigPath);
  }
};

/**
 * set localConfig useInterceptor value
 */
export const setUseInterceptorConfig = (on) => {
  const configPath = getStringFromSettings(settingsNames.LOCAL_CONFIG);
  setLocalConfigProp(configPath, USE_INTERCEPTOR_PATH, !!on);
};
