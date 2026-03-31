import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import * as path from 'path'

let electronApp: ElectronApplication
let window: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../out/main/index.js')],
  })
  window = await electronApp.firstWindow()
  await window.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await electronApp.close()
})

test('Organizer page loads with correct initial state when no scan has run', async () => {
  // Navigate to Organizer
  await window.locator('text=Organizer').click()

  // Without a scan, OrganizerPage shows the no-scan empty state
  await expect(window.locator('text=Scan a folder first')).toBeVisible({ timeout: 10000 })

  // Apply button should not be present (no scan = no apply available)
  await expect(window.getByRole('button', { name: /Apply/i })).not.toBeVisible()
})

test('scan to organize happy path: scan folder, navigate to Organizer, Preview is available', async () => {
  test.setTimeout(60000)

  // Navigate to Duplicates page
  await window.locator('text=Duplicates').click()
  await expect(window.locator('text=Duplicate Files')).toBeVisible({ timeout: 5000 })

  // Start scan on C:\Windows\Fonts (always present on Windows, small directory)
  await window.evaluate((folderPath) => {
    window.api.scanStart(folderPath)
  }, 'C:\\Windows\\Fonts')

  // Wait for scan to complete — look for "Scan Again" button or no-duplicates text
  const scanDone = window.locator('text=/Scan Again|No duplicates|duplicates found/i')
  await expect(scanDone).toBeVisible({ timeout: 45000 })

  // Navigate to Organizer — now that a scan has run, it should show idle state
  await window.locator('text=Organizer').click()

  // Organizer idle state shows strategy tabs and Preview button
  await expect(window.getByRole('button', { name: 'Preview' })).toBeVisible({ timeout: 10000 })

  // By Type tab should be visible (default strategy)
  await expect(window.locator('text=By Type')).toBeVisible()

  // Preview button should be enabled (scan results available)
  const previewBtn = window.getByRole('button', { name: 'Preview' })
  await expect(previewBtn).toBeEnabled()
})
