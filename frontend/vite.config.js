import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    // ponytail: vendor chunks keep the initial bundle light on low-end devices;
    // exceljs/jszip stay out via dynamic import in utils/xlsxExport.js
    rollupOptions: {
      output: {
        manualChunks: {
          handsontable: ['handsontable', '@handsontable/vue3'],
          charts: ['chart.js', 'vue-chartjs'],
          vue: ['vue'],
        },
      },
    },
  },
});
