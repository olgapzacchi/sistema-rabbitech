import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { MusicPlayerProvider } from './lib/player.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MusicPlayerProvider>
        <App />
      </MusicPlayerProvider>
    </BrowserRouter>
  </React.StrictMode>
);
