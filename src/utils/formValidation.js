// Pure, dependency-free form validation helpers for the frontend.
// Each rule receives (value, allValues) and returns an error string or undefined.
// `validate(values, rules)` returns a `{ field: message }` map.

export function required(message = "This field is required") {
  return (value) => {
    if (value === undefined || value === null || String(value).trim() === "") return message;
  };
}

export function email(message = "Enter a valid email address") {
  return (value) => {
    if (!value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) return message;
  };
}

export function phone(message = "Enter a valid phone number") {
  return (value) => {
    if (!value) return;
    if (!/^[+()\-\s0-9]{7,20}$/.test(String(value).trim())) return message;
  };
}

export function positiveNumber(message = "Must be a positive number") {
  return (value) => {
    if (value === undefined || value === null || value === "") return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return message;
  };
}

export function min(value, message = `Must be at least ${value}`) {
  return (v) => {
    if (v === undefined || v === null || v === "") return;
    if (Number(v) < value) return message;
  };
}

export function maxLength(max, message = `Must be ${max} characters or fewer`) {
  return (value) => {
    if (!value) return;
    if (String(value).length > max) return message;
  };
}

export function maxBytes(max, message = `File exceeds the maximum allowed size`) {
  return (file) => {
    if (!file) return;
    if (file.size > max) return message;
  };
}

export function oneOf(options, message = "Select a valid option") {
  return (value) => {
    if (value === undefined || value === null || value === "") return;
    if (!options.includes(value)) return message;
  };
}

export function validate(values = {}, rules = {}) {
  const errors = {};
  for (const [field, validators] of Object.entries(rules)) {
    const list = Array.isArray(validators) ? validators : [validators];
    for (const validator of list) {
      const message = validator?.(values?.[field], values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors || {}).length > 0;
}
