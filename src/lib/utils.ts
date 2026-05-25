export const generateId = () => Math.random().toString(36).substr(2, 9);

export const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

export const parseLocalizedNumber = (value: number | string | undefined | null) => {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null) return Number.NaN;

  return Number.parseFloat(value.trim().replace(',', '.'));
};
