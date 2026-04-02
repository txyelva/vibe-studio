import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterView } from './router'

createRoot(document.getElementById('root')!).render(
    <RouterView />
)
