import React from 'react';
import { createRoot } from 'react-dom/client';
import SignalStation from './components/SignalStation.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SignalStation />
  </React.StrictMode>
);
