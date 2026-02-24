import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client' 
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render( //renders app into root, connects react to the html page
  <StrictMode>
    <App />
  </StrictMode>,
)
