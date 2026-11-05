export function printReceiptInBrowser() {
  if (typeof window === 'undefined' || typeof window.print !== 'function') {
    throw new Error('Browser printing is unavailable in this environment.');
  }
  window.print();
}
