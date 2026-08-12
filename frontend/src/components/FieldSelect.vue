<script setup>
defineProps({
  label: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Pilih' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <label class="field-control">
    <span v-if="label" class="field-label">{{ label }}</span>
    <select
      :value="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
