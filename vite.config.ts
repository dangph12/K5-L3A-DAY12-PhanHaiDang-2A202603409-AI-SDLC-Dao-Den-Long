import {defineConfig} from 'vite'

export default defineConfig({
  build:{
    // Three.js r180 is about 515 kB minified (~131 kB gzip); keep this dependency chunk separate.
    chunkSizeWarningLimit:550,
    rollupOptions:{
      output:{manualChunks(id){if(id.includes('/node_modules/three/'))return 'three'}}
    }
  }
})
