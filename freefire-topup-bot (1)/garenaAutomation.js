const puppeteer = require('puppeteer');

async function runTopup(uid, amountCode, paymentMethod, serial, pin) {
  /*
    uid: string - Free Fire UID to login
    amountCode: string - like 'amount_25', 'amount_weekly'
    paymentMethod: string - 'pay_unipin' or 'pay_upcard'
    serial, pin: voucher strings

    This function automates:
    - Login
    - Select amount
    - Select payment
    - Enter voucher
    - Submit
    - Return screenshot buffer on success
    - Throw error on failure
  */

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://shop.garena.my/app', { waitUntil: 'networkidle2' });

    // === LOGIN ===
    // Assuming there's an input for UID with selector '#uidInput' and a login button '#loginBtn'
    await page.type('#uidInput', uid, { delay: 100 });
    await page.click('#loginBtn');

    // Wait for player name or proceed button to appear to confirm login success
    await page.waitForSelector('#playerName', { timeout: 10000 });

    // === SELECT AMOUNT ===
    // Assuming amounts have buttons with data-amount attribute equal to the amountCode
    // Example: <button data-amount="amount_25">25 Diamond</button>
    const amountSelector = `button[data-amount="\${amountCode}"]`;
    await page.waitForSelector(amountSelector, { timeout: 10000 });
    await page.click(amountSelector);

    // Click proceed to payment button
    await page.waitForSelector('#proceedPayment', { timeout: 10000 });
    await page.click('#proceedPayment');

    // === SELECT PAYMENT METHOD ===
    // paymentMethod = 'pay_unipin' or 'pay_upcard'
    // Buttons: <button data-pay="pay_unipin">UniPin Voucher</button>
    const paySelector = `button[data-pay="\${paymentMethod}"]`;
    await page.waitForSelector(paySelector, { timeout: 10000 });
    await page.click(paySelector);

    // === ENTER SERIAL + PIN ===
    await page.waitForSelector('#serialInput', { timeout: 10000 });
    await page.type('#serialInput', serial, { delay: 50 });

    await page.waitForSelector('#pinInput', { timeout: 10000 });
    await page.type('#pinInput', pin, { delay: 50 });

    // Submit voucher
    await page.click('#submitVoucher');

    // Wait for success or error message
    // Success selector example: '.success-message'
    // Error selector example: '.error-message'
    try {
      await page.waitForSelector('.success-message', { timeout: 10000 });
      // Take screenshot
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      return { success: true, screenshotBuffer };
    } catch {
      // Check if error appeared
      const errorVisible = await page.$('.error-message');
      if (errorVisible) {
        const errorText = await page.evaluate(el => el.textContent, errorVisible);
        return { success: false, error: errorText || 'Invalid serial or PIN or wrong item' };
      }
      throw new Error('Unknown error during voucher submission');
    }
  } finally {
    await browser.close();
  }
}

module.exports = { runTopup };