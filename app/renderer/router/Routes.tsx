/* eslint react/jsx-props-no-spreading: off */
import React from 'react';
import { Switch, Route } from 'react-router-dom';
import routes from '../constants/routes.json';
import App from '../containers/App';
import Launchpad from '../components/pages/Launchpad/Launchpad';
import InFlight from '../components/pages/InFlight/InFlight';

export default function Routes() {
  return (
    <App>
      <Switch>
        <Route path={routes.LAUNCHPAD} component={Launchpad} />
        <Route path={routes.IN_FLIGHT} component={InFlight} />
        <Route path={routes.HOME} component={Launchpad} />
      </Switch>
    </App>
  );
}
