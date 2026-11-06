import { app, BrowserWindow } from 'electron'

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[FAIL] ${msg}`)
    process.exit(1)
  }
  console.log(`[PASS] ${msg}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function run(): Promise<void> {
  await sleep(2000)

  const mainWin = BrowserWindow.getAllWindows().find(
    (w) => !w.webContents.getURL().includes('projection.html')
  )
  assert(Boolean(mainWin), 'Found main application window')
  if (!mainWin) return

  console.log('--- STARTING FULL UI CLICK E2E VERIFICATION ---')

  // Wait for active folder & image to load in Order tab
  await sleep(800)

  const getRibbonButtonText = async (): Promise<string> => {
    return mainWin.webContents.executeJavaScript(
      `document.querySelector('.order-ribbon__go-live')?.textContent?.trim() ?? ''`
    )
  }

  const clickRibbonButton = async (): Promise<void> => {
    await mainWin.webContents.executeJavaScript(
      `document.querySelector('.order-ribbon__go-live')?.click()`
    )
  }

  const initialBtn = await getRibbonButtonText()
  console.log('Initial Order Ribbon button text:', JSON.stringify(initialBtn))
  assert(initialBtn === 'Send to outputs', 'Initial button says Send to outputs')

  // 1. Click "Send to outputs" on Service Order tab
  await clickRibbonButton()
  await sleep(1000)

  const afterSendBtn = await getRibbonButtonText()
  const winsAfterSend = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length
  console.log('After clicking Send to outputs -> button:', JSON.stringify(afterSendBtn), 'windows:', winsAfterSend)
  assert(afterSendBtn === 'Stop projection', 'Order button flipped to Stop projection')
  assert(winsAfterSend === 2, 'Projection window opened from UI click')

  // 2. Switch to Bible tab by clicking the Bible tab button
  await mainWin.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('[role="tab"]'))
      .find(el => el.textContent?.trim() === 'Bible')?.click()
  `)
  await sleep(500)

  const bibleInitialBtn = await getRibbonButtonText()
  console.log('Bible tab initial ribbon button:', JSON.stringify(bibleInitialBtn))
  assert(bibleInitialBtn === 'Send to outputs', 'Bible button initially says Send to outputs')

  // 3. Click "Send to outputs" on Bible tab to overlay verse over Order image
  await clickRibbonButton()
  await sleep(800)

  const bibleLiveBtn = await getRibbonButtonText()
  console.log('Bible tab ribbon button after projecting verse:', JSON.stringify(bibleLiveBtn))
  assert(bibleLiveBtn === 'Stop projection', 'Bible button flipped to Stop projection')

  const projWin = BrowserWindow.getAllWindows().find((w) =>
    w.webContents.getURL().includes('projection.html')
  )!
  const overlayDom = await projWin.webContents.executeJavaScript(`({
    baseImgSrc: document.querySelector('#base-layer img')?.getAttribute('src') ?? '',
    overlayHidden: document.getElementById('overlay-layer')?.hasAttribute('hidden'),
    overlayVisibleClass: document.getElementById('overlay-layer')?.classList.contains('overlay-visible'),
    overlayScrim: document.getElementById('overlay-layer')?.classList.contains('scrim'),
    overlayText: document.getElementById('overlay-layer')?.innerText ?? ''
  })`)
  const previewOverlayText = await mainWin.webContents.executeJavaScript(
    `document.querySelector('.projector-preview__overlay--visible')?.innerText ?? ''`
  )
  console.log('Projection window DOM with Order + Bible overlay:', JSON.stringify(overlayDom))
  console.log('Sidebar Output Preview overlay text:', JSON.stringify(previewOverlayText))
  assert(overlayDom.baseImgSrc.length > 0, 'Order image is present in #base-layer')
  assert(overlayDom.overlayHidden === false, 'Bible #overlay-layer is visible over Order image')
  assert(overlayDom.overlayVisibleClass === true, 'Bible #overlay-layer has fade-in .overlay-visible class')
  assert(overlayDom.overlayScrim === true, 'Bible #overlay-layer has dark scrim over Order image')
  assert(overlayDom.overlayText.length > 0, 'Bible verse text is rendered in overlay')
  assert(previewOverlayText.includes('Song of Solomon 1:12'), 'Sidebar Output Preview mirrors the live Bible verse!')

  // 4. Click "Stop projection" on Bible tab -> Bible overlay disappears, Order image stays!
  await clickRibbonButton()
  await sleep(800)

  const bibleAfterStopBtn = await getRibbonButtonText()
  console.log('Bible tab button after stopping Bible:', JSON.stringify(bibleAfterStopBtn))
  assert(bibleAfterStopBtn === 'Send to outputs', 'Bible button returned to Send to outputs')
  assert(!projWin.isDestroyed(), 'Projection window stayed open because Order is still live')

  const afterBibleStopDom = await projWin.webContents.executeJavaScript(`({
    baseImgSrc: document.querySelector('#base-layer img')?.getAttribute('src') ?? '',
    overlayHidden: document.getElementById('overlay-layer')?.hasAttribute('hidden')
  })`)
  console.log('Projection DOM after stopping Bible:', JSON.stringify(afterBibleStopDom))
  assert(afterBibleStopDom.baseImgSrc.length > 0, 'Order image is STILL running on screen')
  assert(afterBibleStopDom.overlayHidden === true, 'Bible overlay is hidden')

  // 5. Switch back to Service Order tab -> button must STILL say "Stop projection"!
  await mainWin.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('[role="tab"]'))
      .find(el => el.textContent?.trim() === 'Service order')?.click()
  `)
  await sleep(500)

  const orderBtnWhenReturning = await getRibbonButtonText()
  console.log('Order tab button after returning from Bible tab:', JSON.stringify(orderBtnWhenReturning))
  assert(orderBtnWhenReturning === 'Stop projection', 'Order tab still shows Stop projection')

  // 6. Click "Stop projection" on Service Order tab -> Projection window MUST close!
  await clickRibbonButton()
  await sleep(800)

  const orderBtnAfterStop = await getRibbonButtonText()
  const winsAfterOrderStop = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length
  console.log('After clicking Stop projection on Order -> button:', JSON.stringify(orderBtnAfterStop), 'windows:', winsAfterOrderStop)
  assert(orderBtnAfterStop === 'Send to outputs', 'Order button returned to Send to outputs')
  assert(winsAfterOrderStop === 1, 'Projection window completely closed!')

  console.log('--- ALL FULL UI E2E ASSERTIONS PASSED ---')
  app.quit()
}

void run()
