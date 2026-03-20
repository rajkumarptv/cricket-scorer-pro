import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['cricket-scorer-pro-production.up.railway.app', 'localhost'],
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/overlay': 'http://localhost:3000'
    }
  }
})
```

## Steps
1. GitHub repo → `vite.config.ts` → pencil icon (Edit)
2. Replace full content with above
3. **Commit changes**

Railway auto redeploy aagum — 2 minutes wait pannunga then open:
```
https://cricket-scorer-pro-production.up.railway.app
