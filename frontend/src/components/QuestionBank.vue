<script setup>
import { computed, ref } from 'vue';
import { QUESTION_GROUPS } from '../utils/questionBank.js';

const emit = defineEmits(['apply']);

// Panel ini berperilaku seperti dropdown: tertutup secara default.
const open = ref(false);
const openGroups = ref(new Set());

const total = computed(() =>
  QUESTION_GROUPS.reduce((count, group) => count + group.items.length, 0),
);

const isOpen = (title) => openGroups.value.has(title);

function toggleGroup(title) {
  const next = new Set(openGroups.value);
  if (next.has(title)) next.delete(title);
  else next.add(title);
  openGroups.value = next;
}
</script>

<template>
  <section class="question-bank">
    <button
      type="button"
      class="qb-head"
      :aria-expanded="open ? 'true' : 'false'"
      @click="open = !open"
    >
      <span class="qb-title">Pertanyaan populer</span>
      <span class="qb-hint">Klik pertanyaan untuk mengisi pivot otomatis</span>
      <span class="qb-count">{{ total }} pertanyaan</span>
      <span class="qb-caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="qb-body">
      <div v-for="group in QUESTION_GROUPS" :key="group.title" class="qb-group">
        <button
          type="button"
          class="qb-group-head"
          :aria-expanded="isOpen(group.title) ? 'true' : 'false'"
          @click="toggleGroup(group.title)"
        >
          <span class="qb-group-caret" aria-hidden="true">{{ isOpen(group.title) ? '▾' : '▸' }}</span>
          <span class="qb-group-title">{{ group.title }}</span>
          <span class="qb-group-count">{{ group.items.length }}</span>
        </button>

        <ul v-if="isOpen(group.title)" class="qb-list">
          <li v-for="item in group.items" :key="item.text">
            <button type="button" class="qb-question" @click="emit('apply', item)">
              {{ item.text }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.question-bank {
  border-bottom: 1px solid var(--border, #e5e5e3);
  background: var(--surface-alt, #f7f6f3);
}

.qb-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  background: none;
  cursor: pointer;
  text-align: left;
}

.qb-title {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-strong, #111111);
}

.qb-hint {
  font-size: 12px;
  color: var(--muted, #787774);
}

.qb-count {
  margin-left: auto;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--muted, #787774);
}

.qb-caret,
.qb-group-caret {
  font-size: 10px;
  color: var(--muted, #787774);
}

.qb-caret {
  flex: none;
}

.qb-group-caret {
  width: 10px;
}

.qb-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 340px;
  overflow-y: auto;
  padding: 0 14px 14px;
}

.qb-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qb-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 0;
  border: 0;
  background: none;
  cursor: pointer;
  text-align: left;
}

.qb-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-strong, #111111);
}

.qb-group-count {
  margin-left: auto;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: var(--muted, #787774);
}

.qb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0 0 4px 18px;
  list-style: none;
}

.qb-question {
  padding: 5px 10px;
  border: 1px solid var(--border, #e5e5e3);
  border-radius: 9999px;
  background: var(--surface, #ffffff);
  color: var(--ink, #2f3437);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
}

.qb-question:hover {
  border-color: var(--border-strong, #999);
  color: var(--ink-strong, #111111);
}
</style>
