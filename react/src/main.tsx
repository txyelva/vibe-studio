import './assets/styles/global.css'
import { createRoot } from 'react-dom/client'
import './index.css'
import './assets/styles/font.css'
import { RouterView } from './router'

createRoot(document.getElementById('root')!).render(
    <RouterView />
)
