<script setup>
defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  step: { type: Number, default: 0.01 },
  unit: { type: String, default: "" },
  digits: { type: Number, default: 2 },
});

const emit = defineEmits(["update:modelValue"]);

function format(value, digits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return Number.isInteger(n) && digits === 0 ? String(n) : n.toFixed(digits);
}
</script>

<template>
  <label class="field">
    <span class="field-top">
      <span>{{ label }}</span>
      <span class="value">{{ format(modelValue, digits) }}{{ unit ? ` ${unit}` : "" }}</span>
    </span>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="emit('update:modelValue', Number($event.target.value))"
    />
  </label>
</template>
