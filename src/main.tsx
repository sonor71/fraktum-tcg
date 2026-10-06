import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "./ui/styles.css";
import "./ui/mobile.css";
import "./ui/gameplay-v2.css";
import "./ui/match-mobile-final.css";


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
