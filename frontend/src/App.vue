<script setup>
import { ref } from 'vue';
import ReportBuilder from './components/ReportBuilder.vue';
import DataInput from './components/DataInput.vue';

const currentView = ref('report');
</script>

<template>
  <div class="ambient" aria-hidden="true"></div>
  <div class="app">
    <header class="main-nav">
      <div class="nav-links">
        <button :class="{ active: currentView === 'report' }" @click="currentView = 'report'">Laporan</button>
        <button :class="{ active: currentView === 'input' }" @click="currentView = 'input'">Input Data</button>
      </div>
    </header>

    <main class="main-content">
      <ReportBuilder v-if="currentView === 'report'" />
      <DataInput v-else />
    </main>
  </div>
</template>

<style scoped>
.main-nav {
  position: fixed;
  top: 16px;
  left: 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: 9999px;
  padding: 4px;
  z-index: 50;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.nav-links {
  display: flex;
  gap: 2px;
}

.nav-links button {
  background: transparent;
  border: none;
  padding: 6px 14px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.88rem;
  border-radius: 9999px;
  color: var(--muted, #787774);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-links button:hover {
  color: var(--ink-strong, #111111);
  background: rgba(0, 0, 0, 0.04);
}

.nav-links button.active {
  background: var(--ink-strong, #111111);
  color: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.main-content {
  padding-top: 68px;
}

.ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(46% 38% at 12% 8%, rgba(214, 203, 180, 0.18), transparent 70%),
    radial-gradient(40% 34% at 88% 18%, rgba(186, 206, 222, 0.16), transparent 70%);
  animation: drift 28s ease-in-out infinite alternate;
}

@keyframes drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(24px, 40px, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ambient {
    animation: none;
  }
}

.app {
  position: relative;
  z-index: 1;
}
</style>
