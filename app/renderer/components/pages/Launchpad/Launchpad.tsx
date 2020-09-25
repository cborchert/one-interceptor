import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

import _set from 'lodash/set';
import _get from 'lodash/get';

import fs from 'fs';
import settings from 'electron-settings';

import { ipcRenderer } from 'electron';

import Field from '../../atoms/Field/Field';

import ipcEventTypes from '../../../../shared/ipcEventTypes';
import settingsNames from '../../../../shared/settingsNames';
import routes from '../../../constants/routes.json';

import styles from './Launchpad.module.css';

// the path to the simulate host of the config from the local.json root
const HOST_PATH = 'settings.api.simulateHost';

/**
 * Get the domains
 * @returns {Array} the domains
 */
const getDomains = (featurebranchPath): Array<string> => {
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
const getStringFromSettings = (settingName): string => {
  const val = settings.getSync(settingName);
  return typeof val === 'string' ? val : '';
};

/**
 * Set the user's setting for a string val
 */
const setStringToSettings = (settingName, val): string => {
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
const getArrayFromSettings = (settingName) => {
  const val = settings.getSync(settingName);
  return Array.isArray(val) ? val : [];
};

/**
 * Set the user's setting for the an array
 */
const setArrayToSettings = (settingName, val) => {
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
const getLocalConfig = (localConfigPath: string): Record<string, any> => {
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

const setLocalConfigProp = (
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

export default function Launchpad(): JSX.Element {
  const history = useHistory();

  const [localConfigPath, setLocalConfigPath] = useState<string>(
    getStringFromSettings(settingsNames.LOCAL_CONFIG)
  );

  /**
   * Set the local config path and store the value in the settings
   * @param path the local config path
   */
  const updateLocalConfigPath = (path: string) => {
    setLocalConfigPath(setStringToSettings(settingsNames.LOCAL_CONFIG, path));
  };

  const [selectedDomain, setSelectedDomain] = useState<string>('');

  /**
   * On mount, get the featurebranch addresses and the selected domain
   */
  useEffect(() => {
    // if there's no local.json set, skip this step
    if (!localConfigPath) return;

    // Otherwise, get the domains and the selected domains
    const localConfig = getLocalConfig(localConfigPath);
    const domain = _get(localConfig, HOST_PATH, '');

    // TODO: if selectedDomain does not exist, add it to the list
    setSelectedDomain(domain);
  }, [localConfigPath]);

  /**
   * When the selected domain changes, update the simulateHost of the local.json file
   */
  useEffect(() => {
    if (!localConfigPath) return;
    setLocalConfigProp(localConfigPath, HOST_PATH, selectedDomain);

    // Don't update newly selected files
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomain]);

  /**
   * On go button click, send request to start the server to the main process and then go to the in-flight view
   */
  const handleGo = async () => {
    if (!localConfigPath || !selectedDomain) return;
    ipcRenderer.send(ipcEventTypes.SERVER_START_PROMPT);
    history.push(routes.IN_FLIGHT);
  };

  return (
    <div className={styles.Launchpad}>
      <div className={styles.LaunchpadInner}>
        <h2>Launchpad</h2>
        <section>
          <h3>Config</h3>
          <LocalJsonSelect
            localConfigPath={localConfigPath}
            updateLocalConfigPath={updateLocalConfigPath}
          />
        </section>
        <section>
          <ProxySelection
            localConfigPath={localConfigPath}
            selectedDomain={selectedDomain}
            setSelectedDomain={setSelectedDomain}
          />
        </section>

        <section>
          <button
            type="button"
            onClick={handleGo}
            disabled={!localConfigPath || !selectedDomain}
            data-theme="block"
          >
            <span role="img" aria-label="rocket">
              🚀Go
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}

type LocalJsonSelectProps = {
  localConfigPath: string;
  updateLocalConfigPath: any;
};

/**
 * Sets the file location of local.json
 * @param props
 */
const LocalJsonSelect = ({
  localConfigPath,
  updateLocalConfigPath,
}: LocalJsonSelectProps): JSX.Element => {
  /**
   * On modify local.json click, send a request to get a new local.json location
   */
  const requestLocalConfigPath = async () => {
    const path = await ipcRenderer.sendSync(ipcEventTypes.FILE_SELECT_PROMPT, {
      filters: [{ extensions: ['.json'], name: 'local.json Configuration' }],
    });
    if (path) updateLocalConfigPath(path);
  };

  return (
    <div>
      <label htmlFor="local-config-path">
        Config location (local.json)
        <Field>
          <input
            id="local-config-path"
            type="text"
            value={localConfigPath || 'No local.json selected!'}
            disabled
          />
          <button
            type="button"
            className={styles.localJsonButton}
            onClick={requestLocalConfigPath}
          >
            Modify
          </button>
        </Field>
      </label>
    </div>
  );
};

type ProxySelectionProps = {
  localConfigPath: string;
  setSelectedDomain: any;
  selectedDomain: string;
};

const ProxySelection = ({
  localConfigPath,
  setSelectedDomain,
  selectedDomain,
}: ProxySelectionProps) => {
  const [newDomain, setNewDomain] = useState<string>('');
  const [modifiyingDomains, setModifyingDomains] = useState<boolean>(false);
  const [domains, setDomains] = useState<any[]>(
    getArrayFromSettings(settingsNames.DOMAINS)
  );

  /**
   * Set the local config path and store the value in the settings
   * @param path the local config path
   */
  const updateDomains = (val: any[]) => {
    setDomains(setArrayToSettings(settingsNames.DOMAINS, val));
  };

  /**
   * Set the domains config path and store the value in the settings
   * @param path the domains config path
   */
  const importDomainsFromPath = (path: string) => {
    if (!path) return;
    const newDomains = getDomains(path);
    updateDomains(newDomains);
  };

  /**
   * On modify domains.json click, send a request to get a new local.json location
   */
  const requestDomainConfigPath = async () => {
    const path = await ipcRenderer.sendSync(ipcEventTypes.FILE_SELECT_PROMPT, {
      filters: [{ extensions: ['.json'], name: 'domains.json configuration' }],
    });
    importDomainsFromPath(path);
  };

  /**
   * Add the given domain to the list
   * @param domain the new domain
   */
  const addDomain = (domain: string) => {
    updateDomains([...domains, domain]);
    setNewDomain('');
    setSelectedDomain(domain);
  };

  /**
   * Add the given domain to the list
   * @param domain the new domain
   */
  const removeDomain = (targetedDomain: string) => {
    updateDomains(domains.filter((domain) => domain !== targetedDomain));
  };

  return (
    <div>
      <h3>Proxy Domains</h3>
      {!modifiyingDomains ? (
        <div>
          <label htmlFor="domain-select">
            Simulated Host
            <Field>
              <select
                id="domain-select"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                disabled={!localConfigPath}
              >
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
              <button onClick={() => setModifyingDomains(true)} type="button">
                Modify Host List
              </button>
            </Field>
          </label>
        </div>
      ) : (
        <div>
          <ul className={styles.hostList}>
            {domains.map((domain) => (
              <li key={domain} value={domain}>
                <Field>
                  <span>{domain}</span>
                  <button type="button" onClick={() => removeDomain(domain)}>
                    -
                  </button>
                </Field>
              </li>
            ))}
          </ul>
          <Field>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="http://foo.bar"
            />
            <button type="button" onClick={() => addDomain(newDomain)}>
              Add Domain
            </button>
          </Field>
          <Field>
            <button type="button" onClick={requestDomainConfigPath}>
              Import Domains from Files
            </button>
          </Field>
          <Field>
            <button onClick={() => setModifyingDomains(false)} type="button">
              Done
            </button>
          </Field>
        </div>
      )}
    </div>
  );
};
