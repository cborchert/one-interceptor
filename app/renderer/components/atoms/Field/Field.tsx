import React from 'react';

import styles from './Field.module.css';

/**
 * A nice field component for lining up items
 * @param props
 */
const Field = ({ children }: { children: any }) => (
  <div className={styles.field}>{children}</div>
);

export default Field;
