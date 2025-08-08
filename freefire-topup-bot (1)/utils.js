// Voucher parsing helper
function parseVoucher(input) {
  // Remove '-' and '+'
  const cleaned = input.replace(/[-+]/g, '').slice(0, 30);
  const serial = cleaned.slice(0, 14);
  const pin = cleaned.slice(14, 30);
  return { serial, pin };
}

module.exports = { parseVoucher };