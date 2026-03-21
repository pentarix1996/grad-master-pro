export const generateId = () => Math.random().toString(36).substr(2, 9);

export const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');
