import React, { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';
import { useHistory } from 'react-router-dom';

import ipcEventTypes from '../../../../shared/ipcEventTypes';
import routes from '../../../constants/routes.json';

type Response = {
  body: any;
  req: any;
  res: any;
  origin: 'mock' | 'proxy';
};

export default function InFlight(): JSX.Element {
  const history = useHistory();

  /**
   * On button click, send request to start the server to the main process and then go to the in-flight view
   */
  const goToLaunchPad = async () => {
    ipcRenderer.send(ipcEventTypes.SERVER_STOP_PROMPT);
    history.push(routes.LAUNCHPAD);
  };

  const [responses, setResponses] = useState<Response[]>([]);

  /**
   * On mount listen for new responses
   */
  useEffect(() => {
    const addProxyResponse = (event, response) => {
      setResponses((prevResponses) => [...prevResponses, response]);
    };
    const addMockResponse = (event, response) => {
      setResponses((prevResponses) => [...prevResponses, response]);
    };
    ipcRenderer.on(ipcEventTypes.SERVER_ON_PROXY_RESPONSE, addProxyResponse);
    ipcRenderer.on(ipcEventTypes.SERVER_ON_MOCK_RESPONSE, addMockResponse);

    /**
     * On unmount, kill the listeners
     */
    return () => {
      ipcRenderer.off(ipcEventTypes.SERVER_ON_PROXY_RESPONSE, addProxyResponse);
      ipcRenderer.off(ipcEventTypes.SERVER_ON_MOCK_RESPONSE, addMockResponse);
    };
  }, []);

  return (
    <div>
      <h2>In Flight</h2>
      <button type="button" onClick={goToLaunchPad}>
        Back
      </button>
      <ul>
        {responses.map(({ body, req = {}, res = {}, origin, id }) => (
          <li key={id}>
            {`${id}: ${req.url} ${req.method} [${res.statusCode}] (${origin})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
