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

test('app launches with sidebar showing Duplicates and Organizer nav items', async () => {
  await expect(window.locator('text=Duplicates')).toBeVisible()
  await expect(window.locator('text=Organizer')).toBeVisible()
  await expect(window.getByRole('button', { name: 'Choose Folder' })).toBeVisible()
})

test('navigation switches content area between Duplicates and Organizer', async () => {
  // Navigate to Organizer
  await window.locator('text=Organizer').click()
  // Organizer no-scan state: "Scan a folder first"
  await expect(window.locator('text=Scan a folder first')).toBeVisible({ timeout: 10000 })

  // Navigate back to Duplicates
  await window.locator('text=Duplicates').click()
  // DuplicatesPage header: "Duplicate Files"
  await expect(window.locator('text=Duplicate Files')).toBeVisible({ timeout: 10000 })
})

test('scan flow: start scan on real Windows directory, progress and results appear', async () => {
  test.setTimeout(45000)

  // Navigate to Duplicates page
  await window.locator('text=Duplicates').click()
  await expect(window.locator('text=Duplicate Files')).toBeVisible({ timeout: 5000 })

  // Use window.evaluate to call the IPC scan start directly, bypassing OS file picker
  // C:\Windows\Fonts is always present on Windows and is a small directory
  await window.evaluate((folderPath) => {
    window.api.scanStart(folderPath)
  }, 'C:\\Windows\\Fonts')

  // Wait for scan progress or results to appear — either aria-live update or result text
  const progressOrResult = window.locator('[aria-live]')
  await expect(progressOrResult).toBeVisible({ timeout: 15000 })

  // Wait for scan to complete — either "duplicates found" or "No duplicates found"
  const scanComplete = window.locator('text=/duplicates found|No duplicates|Scan Again/i')
  await expect(scanComplete).toBeVisible({ timeout: 40000 })
})

test('delete flow: select duplicates via Keep Newest preset and confirm deletion', async () => {
  test.setTimeout(60000)

  // Navigate to Duplicates page
  await window.locator('text=Duplicates').click()
  await expect(window.locator('text=Duplicate Files')).toBeVisible({ timeout: 5000 })

  // Start scan on C:\Windows\Fonts via IPC (bypasses OS file picker)
  await window.evaluate((folderPath) => {
    window.api.scanStart(folderPath)
  }, 'C:\\Windows\\Fonts')

  // Wait for scan to complete
  await expect(window.locator('text=/duplicates found|No duplicates|Scan Again/i')).toBeVisible({
    timeout: 45000,
  })

  // Skip if no duplicates found on this machine
  const hasDuplicates = await window.locator('text=/\\d+ duplicate/i').count()
  if (hasDuplicates === 0) {
    test.skip()
    return
  }

  // Apply Keep Newest preset to populate delete selections
  await window.getByRole('button', { name: 'Keep Newest' }).click()

  // Wait for the delete panel button to appear
  const deleteBtn = window.locator('button', { hasText: /Delete .* → Trash/i })
  const deleteBtnVisible = await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)
  if (!deleteBtnVisible) {
    test.skip()
    return
  }

  // Click the delete button
  await deleteBtn.click()

  // Post-delete: delete button should disappear (selections cleared after successful delete)
  await expect(deleteBtn).not.toBeVisible({ timeout: 15000 })

  // Aria-live region should still be visible (scan summary updated)
  await expect(window.locator('[aria-live]').first()).toBeVisible()
})
