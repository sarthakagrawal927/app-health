import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Changelog } from './Changelog.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');
const RootView = window.location.pathname === '/changelog' ? Changelog : App;
if (RootView === Changelog) document.title = 'Changelog — App Health';
createRoot(root).render(
  <StrictMode>
    <RootView />
  </StrictMode>,
);
