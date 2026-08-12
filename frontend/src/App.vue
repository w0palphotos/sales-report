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
      <div class="container nav-container">
        <div class="nav-links">
          <button :class="{ active: currentView === 'report' }" @click="currentView = 'report'">Laporan</button>
          <button :class="{ active: currentView === 'input' }" @click="currentView = 'input'">Input Data</button>
        </div>
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
  left: 77%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 9999px;
  padding: 8px 16px 8px 24px;
  z-index: 50;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 32px;
}
.brand {
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
  color: var(--ink-strong);
}
.nav-links {
  display: flex;
  gap: 4px;
}
.nav-links button {
  background: transparent;
  border: none;
  padding: 6px 14px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  border-radius: 9999px;
  color: var(--muted);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.nav-links button:hover {
  color: var(--ink-strong);
  background: rgba(0, 0, 0, 0.03);
}
.nav-links button.active {
  background: var(--ink-strong);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.main-content {
  padding-top: 100px;
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
