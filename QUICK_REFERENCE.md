# Quick Reference: UTC Timestamp Schema

## Schema at a Glance

```javascript
// BEFORE (Current - Ambiguous)
{
  startDateISO: '2025-10-03',      // ❌ What timezone?
  startTime: '14:30',               // ❌ Separate from date
  timeZone: 'America/New_York'      // ❌ Not used consistently
}

// AFTER (Proposed - Unambiguous)
{
  startTimestampUTC: '2025-10-03T18:30:00.000Z',  // ✅ Source of truth
  timeZone: 'America/New_York',                    // ✅ For display
  startDateISO: '2025-10-03',                      // ✅ Cached (queries)
  startTime: '14:30'                                // ✅ Cached (display)
}
```

---

## Common Operations

### Creating a Task

```javascript
import { DateTime } from 'luxon'

// User input
const dateISO = '2025-10-03'
const time = '14:30'
const timezone = 'America/New_York'

// Convert to UTC timestamp
const localDT = DateTime.fromFormat(
  `${dateISO} ${time}`,
  'yyyy-MM-dd HH:mm',
  { zone: timezone }
)
const startTimestampUTC = localDT.toUTC().toISO()
// → '2025-10-03T18:30:00.000Z'

// Store all fields
await Task.create({
  id: generateID(),
  newTaskObj: {
    startTimestampUTC,    // Source of truth
    timeZone: timezone,   // For display
    startDateISO: dateISO, // Cache for queries
    startTime: time        // Cache for display
  }
})
```

### Updating DateTime

```javascript
// User changes time to 3:00 PM
const newTime = '15:00'

// Recompute UTC timestamp
const localDT = DateTime.fromFormat(
  `${task.startDateISO} ${newTime}`,
  'yyyy-MM-dd HH:mm',
  { zone: task.timeZone }
)

await Task.update({
  id: task.id,
  keyValueChanges: {
    startTime: newTime,
    startTimestampUTC: localDT.toUTC().toISO()
  }
})
```

### Displaying in User's Timezone

```javascript
// Fast path: use cached fields (same timezone)
if (userTimezone === task.timeZone) {
  display(task.startDateISO, task.startTime)
}

// Convert to different timezone
else {
  const utcDT = DateTime.fromISO(task.startTimestampUTC, { zone: 'utc' })
  const localDT = utcDT.setZone(userTimezone)
  display(
    localDT.toFormat('yyyy-MM-dd'),
    localDT.toFormat('HH:mm')
  )
}
```

### Querying by Date Range

```javascript
// No change! Still use cached startDateISO
const tasks = await getDocs(
  query(
    collection(db, 'users', uid, 'tasks'),
    where('startDateISO', '>=', '2025-10-03'),
    where('startDateISO', '<=', '2025-10-05')
  )
)
```

### Checking if Notification Should Fire

```javascript
// BEFORE (BUGGY)
const now = DateTime.now().setZone(task.timeZone)
const taskDT = DateTime.fromISO(`${task.startDateISO}T${task.startTime}:00`)
// BUG: taskDT defaults to UTC, not task.timeZone!

// AFTER (CORRECT)
const now = DateTime.now().toUTC()
const taskDT = DateTime.fromISO(task.startTimestampUTC, { zone: 'utc' })
const notifyDT = taskDT.minus({ minutes: task.notify })
return now.hasSame(notifyDT, 'minute')
```

---

## Helper Functions

### toUTCTimestamp

```javascript
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

// Usage
const utc = toUTCTimestamp('2025-10-03', '14:30', 'America/New_York')
// → '2025-10-03T18:30:00.000Z'
```

### fromUTCTimestamp

```javascript
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

// Usage
const { dateISO, time } = fromUTCTimestamp(
  '2025-10-03T18:30:00.000Z',
  'America/New_York'
)
// → { dateISO: '2025-10-03', time: '14:30' }
```

---

## Common Pitfalls

### ❌ Don't: Parse date+time without timezone

```javascript
// WRONG - Ambiguous!
const dt = DateTime.fromISO(`${dateISO}T${time}:00`)
// Defaults to local/UTC, not the intended timezone
```

```javascript
// RIGHT - Explicit timezone
const dt = DateTime.fromFormat(
  `${dateISO} ${time}`,
  'yyyy-MM-dd HH:mm',
  { zone: timezone }
)
```

### ❌ Don't: Forget to update cached fields

```javascript
// WRONG - Cached fields out of sync
await Task.update({
  id: task.id,
  keyValueChanges: {
    startTimestampUTC: newTimestamp  // Only updating UTC
  }
})
```

```javascript
// RIGHT - Update cache too
const { dateISO, time } = fromUTCTimestamp(newTimestamp, task.timeZone)
await Task.update({
  id: task.id,
  keyValueChanges: {
    startTimestampUTC: newTimestamp,
    startDateISO: dateISO,
    startTime: time
  }
})
```

### ❌ Don't: Compare datetimes in different timezones

```javascript
// WRONG - Comparing local times
if (task.startTime > '12:00') // Meaningless without timezone context
```

```javascript
// RIGHT - Compare UTC timestamps
const taskUTC = DateTime.fromISO(task.startTimestampUTC)
const noonUTC = DateTime.fromFormat('12:00', 'HH:mm', {zone: userTZ}).toUTC()
if (taskUTC > noonUTC)
```

### ❌ Don't: Use Date.now() or new Date() directly

```javascript
// WRONG - JavaScript Date is timezone-confused
const now = new Date()
const taskDate = new Date(`${dateISO}T${time}`)
```

```javascript
// RIGHT - Use Luxon with explicit timezones
const now = DateTime.now().toUTC()
const taskDate = DateTime.fromISO(task.startTimestampUTC, {zone: 'utc'})
```

---

## Testing Checklist

### Unit Tests
- [ ] Convert NY time to UTC correctly
- [ ] Convert Tokyo time to UTC correctly
- [ ] Round-trip conversion (UTC → local → UTC)
- [ ] Handle empty/invalid values
- [ ] Handle DST transitions

### Integration Tests
- [ ] Create task with datetime
- [ ] Update task datetime
- [ ] Query tasks by date range
- [ ] Display task in different timezone
- [ ] Notification fires at correct time

### Edge Cases
- [ ] DST spring forward (2am → 3am)
- [ ] DST fall back (2am → 1am happens twice)
- [ ] Midnight crossing (11:30 PM → next day)
- [ ] Timezone near date line (Pacific/Kiritimati)
- [ ] Task without datetime (empty fields)

### DST Test Dates (2025)
```javascript
// Spring forward: March 9, 2025 at 2:00 AM → 3:00 AM
const springForward = '2025-03-09'

// Fall back: November 2, 2025 at 2:00 AM → 1:00 AM
const fallBack = '2025-11-02'

// Test creating tasks around these times
```

---

## Migration Checklist

### Phase 1: Schema
- [ ] Add `startTimestampUTC` to Task schema
- [ ] Add `toUTCTimestamp` helper
- [ ] Add `fromUTCTimestamp` helper
- [ ] Deploy to production

### Phase 2: Dual Write
- [ ] Update `Task.create` to compute UTC
- [ ] Update `Task.update` to recompute UTC
- [ ] Test with new tasks

### Phase 3: Backfill
- [ ] Write migration script
- [ ] Test on staging data
- [ ] Run on production
- [ ] Verify all tasks have UTC timestamp

### Phase 4: Critical Fixes
- [ ] Update `checkNotify.js`
- [ ] Update template instance generation
- [ ] Test notifications fire correctly
- [ ] Test recurring tasks

### Phase 5: UI Updates
- [ ] Update date/time pickers
- [ ] Test calendar view
- [ ] Test task popup
- [ ] Test cross-timezone display

### Phase 6: Testing
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Test DST transitions
- [ ] Test edge cases

### Phase 7: Monitor
- [ ] Set up error tracking
- [ ] Monitor notification accuracy
- [ ] Monitor conversion errors
- [ ] Fix issues as they arise

---

## Troubleshooting

### Issue: Notifications at Wrong Time

**Symptom**: Notification fires hours before/after scheduled time

**Cause**: Not using UTC timestamp, or parsing without timezone

**Fix**:
```javascript
// Change this:
const dt = DateTime.fromISO(`${dateISO}T${time}:00`)

// To this:
const dt = DateTime.fromISO(startTimestampUTC, {zone: 'utc'})
```

### Issue: Tasks Show Wrong Time in Other Timezone

**Symptom**: User in Tokyo sees NY task at wrong time

**Cause**: Using cached fields without conversion

**Fix**:
```javascript
// Change this:
display(task.startDateISO, task.startTime)

// To this:
const localDT = DateTime.fromISO(task.startTimestampUTC)
  .setZone(userTimezone)
display(localDT.toFormat('yyyy-MM-dd'), localDT.toFormat('HH:mm'))
```

### Issue: Queries Return Unexpected Results

**Symptom**: Date range query missing tasks or including wrong ones

**Cause**: Querying on UTC timestamp without timezone context

**Fix**: Keep using cached `startDateISO` for queries
```javascript
// This still works!
where('startDateISO', '>=', '2025-10-03')
where('startDateISO', '<=', '2025-10-05')
```

### Issue: DST Transition Confusion

**Symptom**: Tasks scheduled during DST transition show weird times

**Cause**: Using local time instead of UTC

**Fix**: Always store/compare in UTC, only convert to local for display
```javascript
// Store in UTC (automatic DST handling)
const utc = localDT.toUTC().toISO()

// Display in local (Luxon handles DST)
const local = DateTime.fromISO(utc).setZone(timezone)
```

---

## Performance Tips

### ✅ Do: Use Cached Fields for Display

```javascript
// Fast (no conversion)
display(task.startDateISO, task.startTime)
```

### ✅ Do: Use Cached Fields for Queries

```javascript
// Fast (indexed field)
where('startDateISO', '>=', todayISO)
```

### ✅ Do: Batch Conversions

```javascript
// If you must convert many tasks
const converted = tasks.map(task => ({
  ...task,
  localTime: DateTime.fromISO(task.startTimestampUTC).setZone(userTZ)
}))
```

### ❌ Don't: Convert on Every Render

```javascript
// Slow (100 conversions per render)
{#each tasks as task}
  {DateTime.fromISO(task.startTimestampUTC).toFormat('HH:mm')}
{/each}

// Fast (use cached field)
{#each tasks as task}
  {task.startTime}
{/each}
```

---

## Code Review Checklist

When reviewing datetime-related code:

- [ ] All datetimes have explicit timezone specified
- [ ] UTC timestamp is source of truth
- [ ] Cached fields updated when UTC timestamp changes
- [ ] No parsing of date+time without timezone context
- [ ] Comparisons done in UTC, not local time
- [ ] Display conversions use cached fields when possible
- [ ] Queries use cached `startDateISO` for performance
- [ ] Error handling for invalid datetimes
- [ ] Tests cover DST transitions
- [ ] No use of bare `new Date()` or `Date.now()`

---

## Resources

- **Luxon Docs**: https://moment.github.io/luxon/
- **IANA Timezone Database**: https://www.iana.org/time-zones
- **ISO 8601**: https://en.wikipedia.org/wiki/ISO_8601
- **Full Documentation**: See README_TIMEZONE_MIGRATION.md

---

## Quick Wins

After migration, you get:

✅ No more notification bugs  
✅ No more DST confusion  
✅ No more cross-timezone display issues  
✅ International users supported  
✅ Same or better performance  
✅ Industry-standard approach  

**Time to implement**: 6-8 weeks  
**Time saved debugging timezone bugs**: Forever  

---

**Remember**: When in doubt, store in UTC, display in local timezone!
