# Implementation Guide: UTC Timestamp Migration

## Overview

This guide provides step-by-step instructions for migrating from the current `startDateISO + startTime + timeZone` schema to a UTC timestamp-based approach with cached display fields.

---

## Phase 1: Update Schema (Week 1)

### 1.1 Update Task Model

**File**: `src/lib/db/models/Task.js`

```javascript
// CURRENT (lines 23-35)
const Task = {
  schema: z.object({
    name: z.string().default('Untitled'),
    duration: z.number().default(30),
    parentID: z.string().default(''),
    startTime: z.string().default(''),
    startDateISO: z.string()
      .default('')
      .refine(isValidISODate, {
        message: 'startDateISO is not in proper yyyy-MM-dd format'
      }),
    // ... rest of schema
  })
}
```

```javascript
// NEW (add startTimestampUTC)
const Task = {
  schema: z.object({
    name: z.string().default('Untitled'),
    duration: z.number().default(30),
    parentID: z.string().default(''),
    
    // NEW: Primary source of truth
    startTimestampUTC: z.string().default(''),
    
    // KEPT: Cached for queries and display
    startTime: z.string().default(''),
    startDateISO: z.string()
      .default('')
      .refine(isValidISODate, {
        message: 'startDateISO is not in proper yyyy-MM-dd format'
      }),
    
    timeZone: z.string().default(Intl.DateTimeFormat().resolvedOptions().timeZone),
    // ... rest of schema
  })
}
```

### 1.2 Add Helper Functions

**File**: `src/lib/db/models/Task.js` (add at top)

```javascript
import { DateTime } from 'luxon'

/**
 * Converts local date/time to UTC timestamp
 * @param {string} dateISO - Format: 'yyyy-MM-dd'
 * @param {string} time - Format: 'HH:mm'
 * @param {string} timezone - IANA timezone
 * @returns {string} UTC ISO timestamp
 */
export function toUTCTimestamp(dateISO, time, timezone) {
  if (!dateISO || !time) return ''
  
  const localDT = DateTime.fromFormat(
    `${dateISO} ${time}`,
    'yyyy-MM-dd HH:mm',
    { zone: timezone }
  )
  
  if (!localDT.isValid) {
    console.error('Invalid datetime:', { dateISO, time, timezone })
    return ''
  }
  
  return localDT.toUTC().toISO()
}

/**
 * Converts UTC timestamp to local date/time
 * @param {string} timestampUTC - ISO 8601 UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {object} { dateISO, time }
 */
export function fromUTCTimestamp(timestampUTC, timezone) {
  if (!timestampUTC) return { dateISO: '', time: '' }
  
  const localDT = DateTime.fromISO(timestampUTC, { zone: 'utc' })
    .setZone(timezone)
  
  return {
    dateISO: localDT.toFormat('yyyy-MM-dd'),
    time: localDT.toFormat('HH:mm')
  }
}
```

---

## Phase 2: Dual Write (Week 1-2)

### 2.1 Update Task.create

**File**: `src/lib/db/models/Task.js`

```javascript
// MODIFY the create method (lines 56-96)
create: async ({ id, newTaskObj }) => {
  try {
    const validatedTask = Task.schema.parse(newTaskObj)
    const { uid } = get(user)
    const batch = writeBatch(db)
    
    // NEW: Compute UTC timestamp if date/time provided
    if (validatedTask.startDateISO && validatedTask.startTime && !validatedTask.startTimestampUTC) {
      validatedTask.startTimestampUTC = toUTCTimestamp(
        validatedTask.startDateISO,
        validatedTask.startTime,
        validatedTask.timeZone
      )
    }
    
    // NEW: Compute cached fields if timestamp provided but not cached fields
    if (validatedTask.startTimestampUTC && !validatedTask.startDateISO) {
      const { dateISO, time } = fromUTCTimestamp(
        validatedTask.startTimestampUTC,
        validatedTask.timeZone
      )
      validatedTask.startDateISO = dateISO
      validatedTask.startTime = time
    }
    
    const result = await maintainTreeISOsForCreate({ task: validatedTask, batch })
    // ... rest of create logic (unchanged)
  }
  // ... error handling
}
```

### 2.2 Update Task.update

**File**: `src/lib/db/models/Task.js`

```javascript
// MODIFY the update method (lines 99-115)
update: async ({ id, keyValueChanges }) => {
  try {
    const batch = writeBatch(db)
    const validatedChanges = Task.schema.partial().parse(keyValueChanges)
    
    // NEW: Handle datetime field updates
    const needsTimestampUpdate = 
      validatedChanges.startDateISO !== undefined ||
      validatedChanges.startTime !== undefined ||
      validatedChanges.timeZone !== undefined
    
    if (needsTimestampUpdate) {
      // Get current task data to merge with changes
      const currentTask = get(tasksCache)[id]
      const dateISO = validatedChanges.startDateISO ?? currentTask.startDateISO
      const time = validatedChanges.startTime ?? currentTask.startTime
      const timezone = validatedChanges.timeZone ?? currentTask.timeZone
      
      // Recompute UTC timestamp
      if (dateISO && time) {
        validatedChanges.startTimestampUTC = toUTCTimestamp(dateISO, time, timezone)
      } else {
        validatedChanges.startTimestampUTC = ''
      }
    }
    
    // Handle case where only timestamp is provided
    if (validatedChanges.startTimestampUTC && !needsTimestampUpdate) {
      const currentTask = get(tasksCache)[id]
      const { dateISO, time } = fromUTCTimestamp(
        validatedChanges.startTimestampUTC,
        validatedChanges.timeZone ?? currentTask.timeZone
      )
      validatedChanges.startDateISO = dateISO
      validatedChanges.startTime = time
    }
    
    await maintainTreeISOs({ id, keyValueChanges: validatedChanges, batch })
    batch.update(
      doc(db, `users/${get(user).uid}/tasks/${id}`), 
      validatedChanges
    )
    batch.commit()
  }
  catch (error) {
    alert("Error saving changes to db, please reload")
    console.error("Error in Task.update: ", error)
  }
}
```

---

## Phase 3: Backfill Existing Data (Week 2)

### 3.1 Create Migration Script

**File**: `src/lib/db/scripts/migrateToUTCTimestamp.js` (NEW FILE)

```javascript
import { db } from '$lib/db/init.js'
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { DateTime } from 'luxon'

export async function migrateTasksToUTC(userID) {
  console.log(`Starting UTC migration for user: ${userID}`)
  
  const tasksRef = collection(db, 'users', userID, 'tasks')
  const snapshot = await getDocs(tasksRef)
  
  let migrated = 0
  let skipped = 0
  let errors = []
  
  // Process in batches of 500 (Firestore limit)
  const batches = []
  let currentBatch = writeBatch(db)
  let batchCount = 0
  
  for (const taskDoc of snapshot.docs) {
    const task = taskDoc.data()
    
    // Skip if already has UTC timestamp
    if (task.startTimestampUTC) {
      skipped++
      continue
    }
    
    // Skip if no date/time to migrate
    if (!task.startDateISO || !task.startTime) {
      skipped++
      continue
    }
    
    try {
      // Convert to UTC timestamp
      const localDT = DateTime.fromFormat(
        `${task.startDateISO} ${task.startTime}`,
        'yyyy-MM-dd HH:mm',
        { zone: task.timeZone || 'America/Los_Angeles' } // Default fallback
      )
      
      if (!localDT.isValid) {
        errors.push({
          id: taskDoc.id,
          error: 'Invalid datetime',
          data: { startDateISO: task.startDateISO, startTime: task.startTime }
        })
        continue
      }
      
      const startTimestampUTC = localDT.toUTC().toISO()
      
      currentBatch.update(doc(db, 'users', userID, 'tasks', taskDoc.id), {
        startTimestampUTC
      })
      
      migrated++
      batchCount++
      
      // Commit batch if we hit 500 operations
      if (batchCount === 500) {
        batches.push(currentBatch.commit())
        currentBatch = writeBatch(db)
        batchCount = 0
      }
    } catch (error) {
      errors.push({
        id: taskDoc.id,
        error: error.message,
        data: task
      })
    }
  }
  
  // Commit remaining operations
  if (batchCount > 0) {
    batches.push(currentBatch.commit())
  }
  
  // Wait for all batches to complete
  await Promise.all(batches)
  
  console.log(`Migration complete:`)
  console.log(`  - Migrated: ${migrated}`)
  console.log(`  - Skipped: ${skipped}`)
  console.log(`  - Errors: ${errors.length}`)
  
  if (errors.length > 0) {
    console.error('Migration errors:', errors)
  }
  
  return { migrated, skipped, errors }
}

// Run migration for current user (call from browser console)
export async function runMigrationForCurrentUser() {
  const { user } = await import('$lib/store')
  const { get } = await import('svelte/store')
  const userData = get(user)
  
  if (!userData || !userData.uid) {
    console.error('No user logged in')
    return
  }
  
  return migrateTasksToUTC(userData.uid)
}
```

### 3.2 Add Migration UI (Optional)

**File**: `src/routes/[user]/components/Settings/MigrateButton.svelte` (NEW FILE)

```svelte
<script>
  import { migrateTasksToUTC } from '$lib/db/scripts/migrateToUTCTimestamp.js'
  import { user } from '$lib/store'
  
  let loading = false
  let result = null
  
  async function handleMigrate() {
    if (!confirm('Migrate all tasks to UTC timestamp format? This is safe and can be run multiple times.')) {
      return
    }
    
    loading = true
    result = null
    
    try {
      result = await migrateTasksToUTC($user.uid)
    } catch (error) {
      alert('Migration failed: ' + error.message)
      console.error(error)
    } finally {
      loading = false
    }
  }
</script>

<div>
  <button onclick={handleMigrate} disabled={loading}>
    {loading ? 'Migrating...' : 'Migrate to UTC Timestamps'}
  </button>
  
  {#if result}
    <div style="margin-top: 8px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
      <strong>Migration Complete</strong>
      <ul style="margin: 4px 0; padding-left: 20px;">
        <li>Migrated: {result.migrated} tasks</li>
        <li>Skipped: {result.skipped} tasks</li>
        <li>Errors: {result.errors.length}</li>
      </ul>
    </div>
  {/if}
</div>
```

---

## Phase 4: Update Critical Functions (Week 2-3)

### 4.1 Fix Notification Function

**File**: `functions/checkNotify.js`

```javascript
// CURRENT (lines 65-79) - BUGGY
const shouldNotifyNow = (taskData) => {
  const now = DateTime.now().setZone(taskData.timeZone);
  const taskDateTime = DateTime.fromISO(
    `${taskData.startDateISO}T${taskData.startTime}:00`,
  );
  const notifyMinutes = parseInt(taskData.notify, 10);
  if (isNaN(notifyMinutes)) {
    functions.logger.error('Invalid notify value:', taskData);
    return false;
  }

  return notifyMinutes === 0
    ? now.hasSame(taskDateTime, 'minute')
    : now.hasSame(taskDateTime.minus({ minutes: notifyMinutes }), 'minute');
};
```

```javascript
// NEW - CORRECT
const shouldNotifyNow = (taskData) => {
  // Use UTC timestamp if available (new format)
  const taskDateTime = taskData.startTimestampUTC
    ? DateTime.fromISO(taskData.startTimestampUTC, { zone: 'utc' })
    : DateTime.fromFormat(
        `${taskData.startDateISO} ${taskData.startTime}`,
        'yyyy-MM-dd HH:mm',
        { zone: taskData.timeZone }
      );
  
  if (!taskDateTime.isValid) {
    functions.logger.error('Invalid task datetime:', taskData);
    return false;
  }
  
  const notifyMinutes = parseInt(taskData.notify, 10);
  if (isNaN(notifyMinutes)) {
    functions.logger.error('Invalid notify value:', taskData);
    return false;
  }

  // Compare in UTC for accuracy
  const now = DateTime.now().toUTC();
  const notifyTime = taskDateTime.toUTC().minus({ minutes: notifyMinutes });

  return notifyMinutes === 0
    ? now.hasSame(taskDateTime.toUTC(), 'minute')
    : now.hasSame(notifyTime, 'minute');
};
```

### 4.2 Update Template Instance Generation

**File**: `src/routes/[user]/components/Templates/components/TemplatePopup/instances.js`

```javascript
// MODIFY instantiateTask (lines 36-42)
export function instantiateTask ({ template, occurrence }) {
  const newTaskObj = Task.schema.parse(template)
  newTaskObj.templateID = template.id
  
  // NEW: Use occurrence date with template time
  const occurrenceDate = DateTime.fromJSDate(occurrence).toFormat('yyyy-MM-dd')
  const templateTime = template.startTime || '09:00'
  const timezone = template.timeZone
  
  // Set cached fields
  newTaskObj.startDateISO = occurrenceDate
  newTaskObj.startTime = templateTime
  newTaskObj.timeZone = timezone
  
  // NEW: Compute UTC timestamp
  if (occurrenceDate && templateTime) {
    const localDT = DateTime.fromFormat(
      `${occurrenceDate} ${templateTime}`,
      'yyyy-MM-dd HH:mm',
      { zone: timezone }
    )
    newTaskObj.startTimestampUTC = localDT.toUTC().toISO()
  }
  
  newTaskObj.persistsOnList = false
  return newTaskObj
}
```

---

## Phase 5: Update UI Components (Week 3-4)

### 5.1 Date/Time Picker

**File**: `src/routes/[user]/components/TaskPopup/StartTimeDurationNotify.svelte`

```javascript
// MODIFY handleChanges (lines 12-25)
function handleChanges (key, value, updateTimeZone = false) {
  if (typeof Number(value) !== "number" && key !== 'startDateISO' && key !== 'startTime') return

  const taskUpdates = { [key]: value }
  
  // NEW: Update timezone if requested
  if (updateTimeZone) {
    taskUpdates.timeZone = DateTime.local().zoneName
  }
  
  // NEW: When date or time changes, recompute UTC timestamp
  if (key === 'startDateISO' || key === 'startTime') {
    const dateISO = key === 'startDateISO' ? value : taskObject.startDateISO
    const time = key === 'startTime' ? value : taskObject.startTime
    const timezone = taskUpdates.timeZone || taskObject.timeZone
    
    // Import helper function
    const { toUTCTimestamp } = await import('$lib/db/models/Task.js')
    
    if (dateISO && time) {
      taskUpdates.startTimestampUTC = toUTCTimestamp(dateISO, time, timezone)
    } else {
      taskUpdates.startTimestampUTC = ''
    }
  }

  Task.update({
    id: taskObject.id,
    keyValueChanges: taskUpdates
  })
}
```

### 5.2 Calendar Service (Queries)

**File**: `src/routes/[user]/components/Calendar/service.js`

No changes needed! Queries still use `startDateISO`:

```javascript
// Lines 15-17 (UNCHANGED)
export function setupCalListener (leftDT, rightDT) {  
  const leftISO = leftDT.toFormat('yyyy-MM-dd')
  const rightISO = rightDT.toFormat('yyyy-MM-dd')
  // ... uses treeISOs for querying (already correct)
}
```

### 5.3 Date Badge Display

**File**: `src/routes/[user]/components/TaskTree/DateBadge.svelte`

```javascript
// Lines 12-15 (UNCHANGED - uses cached startDateISO)
function isToday (iso) {
  const dt = DateTime.fromISO(iso)
  return dt.toFormat('yyyy-MM-dd') === DateTime.now().toFormat('yyyy-MM-dd')
}
```

---

## Phase 6: Add Tests (Week 4)

### 6.1 Datetime Conversion Tests

**File**: `src/lib/db/models/Task.test.js` (NEW FILE)

```javascript
import { describe, it, expect } from 'vitest'
import { toUTCTimestamp, fromUTCTimestamp } from './Task.js'
import { DateTime } from 'luxon'

describe('UTC Timestamp Conversion', () => {
  it('converts NY time to UTC correctly', () => {
    const utc = toUTCTimestamp('2025-10-03', '14:30', 'America/New_York')
    expect(utc).toBe('2025-10-03T18:30:00.000Z') // EDT is UTC-4
  })
  
  it('converts Tokyo time to UTC correctly', () => {
    const utc = toUTCTimestamp('2025-10-03', '14:30', 'Asia/Tokyo')
    expect(utc).toBe('2025-10-03T05:30:00.000Z') // JST is UTC+9
  })
  
  it('handles DST transition correctly', () => {
    // March 9, 2025: DST begins at 2am (skips to 3am)
    const utc = toUTCTimestamp('2025-03-09', '03:00', 'America/New_York')
    expect(utc).toBe('2025-03-09T07:00:00.000Z') // EDT is UTC-4
  })
  
  it('round-trips correctly', () => {
    const original = { dateISO: '2025-10-03', time: '14:30', timezone: 'America/New_York' }
    const utc = toUTCTimestamp(original.dateISO, original.time, original.timezone)
    const converted = fromUTCTimestamp(utc, original.timezone)
    
    expect(converted.dateISO).toBe(original.dateISO)
    expect(converted.time).toBe(original.time)
  })
  
  it('handles empty values', () => {
    expect(toUTCTimestamp('', '14:30', 'America/New_York')).toBe('')
    expect(toUTCTimestamp('2025-10-03', '', 'America/New_York')).toBe('')
    expect(fromUTCTimestamp('', 'America/New_York')).toEqual({ dateISO: '', time: '' })
  })
})
```

---

## Phase 7: Monitoring & Rollback (Ongoing)

### 7.1 Add Logging

**File**: `src/lib/db/models/Task.js`

```javascript
// Add to toUTCTimestamp function
export function toUTCTimestamp(dateISO, time, timezone) {
  if (!dateISO || !time) return ''
  
  const localDT = DateTime.fromFormat(
    `${dateISO} ${time}`,
    'yyyy-MM-dd HH:mm',
    { zone: timezone }
  )
  
  if (!localDT.isValid) {
    console.error('Invalid datetime:', { dateISO, time, timezone })
    // NEW: Track invalid conversions
    if (typeof window !== 'undefined' && window.posthog) {
      window.posthog.capture('timezone_conversion_error', {
        dateISO,
        time,
        timezone,
        error: localDT.invalidReason
      })
    }
    return ''
  }
  
  const utc = localDT.toUTC().toISO()
  
  // NEW: Log successful conversions (remove after stable)
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture('timezone_conversion_success', {
      dateISO,
      time,
      timezone,
      utc
    })
  }
  
  return utc
}
```

### 7.2 Rollback Strategy

If issues arise, the old fields are still present:

```javascript
// Emergency rollback: stop computing UTC timestamp
// In Task.create and Task.update, comment out these sections:

// if (validatedTask.startDateISO && validatedTask.startTime && !validatedTask.startTimestampUTC) {
//   validatedTask.startTimestampUTC = toUTCTimestamp(...)
// }

// System reverts to using startDateISO + startTime + timeZone
// No data loss - old fields still populated
```

---

## Timeline Summary

| Phase | Duration | Description | Critical? |
|-------|----------|-------------|-----------|
| 1. Schema Update | 1 week | Add `startTimestampUTC` field | Yes |
| 2. Dual Write | 1-2 weeks | Populate both old and new | Yes |
| 3. Backfill | 1 week | Migrate existing tasks | Yes |
| 4. Critical Functions | 1-2 weeks | Fix notifications, templates | Yes |
| 5. UI Updates | 1-2 weeks | Update components | Medium |
| 6. Testing | 1 week | Add comprehensive tests | Medium |
| 7. Monitoring | Ongoing | Track conversions, handle issues | Low |

**Total: 6-8 weeks** (calendar time, ~3-4 weeks of actual development)

---

## Validation Checklist

Before considering migration complete:

- [ ] All new tasks have `startTimestampUTC` populated
- [ ] All existing tasks backfilled (migration script run)
- [ ] Notifications fire at correct time (test in multiple timezones)
- [ ] Template instances create with correct timestamps
- [ ] Calendar queries return same results as before
- [ ] Date badge displays correctly
- [ ] DST transitions handled correctly (test around March/November)
- [ ] Cross-timezone viewing works (test with VPN)
- [ ] Performance is equivalent or better
- [ ] No Firebase quota issues
- [ ] Error logging in place
- [ ] Rollback plan tested

---

## Post-Migration (Optional)

After 6+ months of stability, you can optionally:

1. **Deprecate cached fields**: Stop writing `startDateISO`/`startTime`, compute on-the-fly
2. **Update queries**: Use `startTimestampUTC` directly instead of `startDateISO`
3. **Remove old fields**: Clean up schema (save ~15 bytes per task)

However, keeping the cached fields is **recommended** for performance - the storage cost is negligible.
