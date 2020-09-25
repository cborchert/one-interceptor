import React, { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';
import { useHistory } from 'react-router-dom';

import ipcEventTypes from '../../../../shared/ipcEventTypes';
import routes from '../../../constants/routes.json';

import styles from './InFlight.module.css';

type Response = {
  id: any;
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

  const [showResponse, setShowResponse] = useState<Response>();

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

      {showResponse ? (
        <ResponseModal
          response={showResponse}
          onClose={() => setShowResponse(undefined)}
        />
      ) : (
        <ResponseTable
          responses={responses}
          setShowResponse={setShowResponse}
        />
      )}
    </div>
  );
}

type ResponseTabeProps = {
  responses: Response[];
  setShowResponse: any;
};
/**
 * Display the reponses
 * @param props
 */
const ResponseTable = ({
  responses = [],
  setShowResponse,
}: ResponseTabeProps): JSX.Element => (
  <ul className={styles.responseTable}>
    <li className={styles.responseHeader}>
      <div>id</div>
      <div>Method</div>
      <div>Path</div>
      <div>Status</div>
      <div>Proxy/Mock</div>
      <div>Response</div>
      <div>...</div>
    </li>
    {responses.map((response) => {
      const { req = {}, res = {}, origin, id } = response;
      return (
        <li className={styles.response} key={id}>
          <div>{id}</div>
          <div>{req.method}</div>
          <div title={req.url}>{req.url}</div>
          <div data-status={res.statusCode}>{res.statusCode}</div>
          <div data-origin={origin}>{origin}</div>
          <div>
            <button onClick={() => setShowResponse(response)} type="button">
              <i className="far fa-eye" />
            </button>
          </div>
          <div>...</div>
        </li>
      );
    })}
  </ul>
);

type ResponseModalProps = {
  response: Response;
  onClose: any;
};

const ResponseModal = ({
  response,
  onClose,
}: ResponseModalProps): JSX.Element => (
  <div className={styles.modal}>
    <div className={styles.modalHeader}>
      <span>{`[${response.req.method}] ${response.req.url}`}</span>
      <button onClick={onClose} type="button">
        close
      </button>
    </div>
    <pre className={styles.modalInner}>
      {JSON.stringify(response.body || {}, null, '  ')}
    </pre>
  </div>
);
