<script setup>
import { computed } from 'vue';

const props = defineProps({
  filter: { type: Object, required: true },
  meta: { type: Object, default: null },
  index: { type: Number, required: true },
});

const emit = defineEmits(['update', 'remove']);

const toNumber = (value) =>
  value === '' || value == null || Number.isNaN(Number(value)) ? '' : Number(value);

const field = computed(() => {
  if (!props.filter.field) return null;
  return (
    (props.meta?.dimensions ?? []).find((dimension) => dimension.key === props.filter.field) ??
    (props.meta?.measures ?? []).find((measure) => measure.key === props.filter.field)
  );
});

const fieldValues = computed(() => field.value?.values ?? []);

const availableOperators = computed(() => {
  if (!field.value) return [];
  const isNumber = field.value.type === 'number';
  return (props.meta?.operators ?? []).filter((operator) =>
    isNumber ? !operator.textOnly : !operator.numberOnly,
  );
});

function patch(patchObject) {
  emit('update', patchObject);
}

function onFieldChange(event) {
  const key = event.target.value;
  const nextField =
    (props.meta?.dimensions ?? []).find((dimension) => dimension.key === key) ??
    (props.meta?.measures ?? []).find((measure) => measure.key === key);
  const operator = nextField?.type === 'number' ? '=' : '=';
  patch({ field: key, operator, value: nextField?.type === 'number' ? '' : '' });
}

function onOperatorChange(event) {
  const operator = event.target.value;
  if (operator === 'between') {
    const current = Array.isArray(props.filter.value) ? props.filter.value[0] : '';
    patch({ operator, value: [current, ''] });
  } else {
    patch({ operator, value: Array.isArray(props.filter.value) ? '' : props.filter.value });
  }
}
</script>

<template>
  <div class="filter-row" :class="{ 'is-between': filter.operator === 'between' }">
    <select :value="filter.field" @change="onFieldChange">
      <option value="" disabled>Field</option>
      <option v-for="dimension in meta?.dimensions ?? []" :key="dimension.key" :value="dimension.key">
        {{ dimension.label }}
      </option>
      <option v-for="measure in meta?.measures ?? []" :key="measure.key" :value="measure.key">
        {{ measure.label }}
      </option>
    </select>

    <select :value="filter.operator" @change="onOperatorChange">
      <option value="" disabled>Operator</option>
      <option v-for="operator in availableOperators" :key="operator.key" :value="operator.key">
        {{ operator.label }}
      </option>
    </select>

    <template v-if="filter.operator === 'between'">
      <input
        type="number"
        :value="Array.isArray(filter.value) ? filter.value[0] : ''"
        placeholder="Minimal"
        @input="
          patch({ value: [toNumber($event.target.value), toNumber(Array.isArray(filter.value) ? filter.value[1] : '')] })
        "
      />
      <input
        type="number"
        :value="Array.isArray(filter.value) ? filter.value[1] : ''"
        placeholder="Maksimal"
        @input="
          patch({ value: [toNumber(Array.isArray(filter.value) ? filter.value[0] : ''), toNumber($event.target.value)] })
        "
      />
    </template>

    <select
      v-else-if="field?.type === 'text' && (filter.operator === '=' || filter.operator === '!=')"
      :value="filter.value"
      @change="patch({ value: $event.target.value })"
    >
      <option value="" disabled>Pilih nilai</option>
      <option v-for="value in fieldValues" :key="value" :value="value">{{ value }}</option>
    </select>

    <input
      v-else-if="field?.type === 'text'"
      type="text"
      :value="filter.value"
      placeholder="Teks"
      @input="patch({ value: $event.target.value })"
    />

    <input
      v-else
      type="number"
      :value="filter.value"
      placeholder="Angka"
      @input="patch({ value: toNumber($event.target.value) })"
    />

    <button type="button" class="btn-icon" :aria-label="`Hapus filter ${index + 1}`" @click="emit('remove')">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
</template>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr auto;
  gap: 8px;
  align-items: end;
}

.filter-row.is-between {
  grid-template-columns: 1fr 1fr 1fr 1fr auto;
}
</style>
