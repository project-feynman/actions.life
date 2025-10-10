# Timezone-Robust Schema Migration Analysis

## Current State

### Current Schema
```javascript
{
  startDateISO: string,  // Format: 'yyyy-MM-dd' (e.g., '2025-10-03')
  startTime: string,     // Format: 'hh:mm' (e.g., '14:30')
  timeZone: string,      // IANA timezone (e.g., 'America/New_York')
  duration: number       // Duration in minutes
}
```

### Problems with Current Approach
1. **Ambiguous DateTime**: The combination of `startDateISO` (date-only) and `startTime` (time-only) creates timezone ambiguity during:
   - Daylight Saving Time transitions
   - Cross-timezone collaboration
   - Data migration/import
   
2. **Local Interpretation**: The date 'yyyy-MM-dd' is interpreted in local timezone context, not explicitly in the stored `timeZone`

3. **Querying Issues**: Firebase queries on `startDateISO` assume all tasks use the same timezone context

4. **Notification Logic**: Currently combines date + time + timezone in `checkNotify.js`:
   ```javascript
   const taskDateTime = DateTime.fromISO(`${taskData.startDateISO}T${taskData.startTime}:00`)
   ```
   This assumes the ISO date is in the task's timezone, but there's potential for misinterpretation.

## Pareto-Optimal Solutions

### Solution A: UTC Timestamp with IANA Timezone (Recommended)

#### Schema
```javascript
{
  startTimestampUTC: string,  // ISO 8601 UTC timestamp: '2025-10-03T18:30:00Z'
  timeZone: string,           // IANA timezone: 'America/New_York'
  duration: number,           // Duration in minutes
  
  // Computed/cached fields (optional for performance)
  startDateISO: string,       // Denormalized for queries: '2025-10-03'
  startTime: string           // Denormalized for display: '14:30'
}
```

#### Advantages
✅ **Unambiguous point in time**: Single source of truth  
✅ **DST-safe**: UTC never changes  
✅ **Cross-timezone collaboration**: Everyone sees correct time  
✅ **Easy sorting/comparison**: Timestamps are directly comparable  
✅ **Industry standard**: Follows best practices (Unix timestamp equivalent)  
✅ **Future-proof**: Supports timezone rule changes  
✅ **Display flexibility**: Can render in any timezone  

#### Disadvantages
❌ **Migration complexity**: Need to convert existing data  
❌ **Storage overhead**: Slightly more data (but negligible)  
❌ **Query adjustment**: Firebase queries need restructuring  
❌ **Denormalization**: If keeping cached fields, risk of inconsistency  

#### Implementation Details
```javascript
// Storage (write)
const localDateTime = DateTime.fromFormat('2025-10-03 14:30', 'yyyy-MM-dd HH:mm', {
  zone: 'America/New_York'
})
const startTimestampUTC = localDateTime.toUTC().toISO() // '2025-10-03T18:30:00.000Z'

// Retrieval (read)
const localDateTime = DateTime.fromISO(startTimestampUTC, { zone: 'America/New_York' })
const displayDate = localDateTime.toFormat('yyyy-MM-dd') // '2025-10-03'
const displayTime = localDateTime.toFormat('HH:mm')      // '14:30'

// Queries (if denormalizing)
where('startDateISO', '>=', '2025-10-03') // Still works!
```

---

### Solution B: Zoned DateTime String

#### Schema
```javascript
{
  startDateTime: string,  // ISO 8601 with timezone: '2025-10-03T14:30:00-04:00'
  timeZone: string,       // IANA timezone: 'America/New_York' (redundant but useful)
  duration: number
}
```

#### Advantages
✅ **Single field**: One string contains all information  
✅ **Timezone offset preserved**: Offset at time of creation stored  
✅ **ISO 8601 standard**: Widely supported  
✅ **Human readable**: Can see time and offset together  

#### Disadvantages
❌ **Redundant offset**: Timezone offset can drift from IANA timezone  
❌ **DST ambiguity**: During "fall back", same local time occurs twice  
❌ **Query complexity**: Harder to query by date ranges  
❌ **No timezone rule updates**: If timezone rules change, old offsets are wrong  
❌ **Migration still needed**: Current data doesn't have timezone offset  

---

### Solution C: Keep Current, Store Computed UTC

#### Schema
```javascript
{
  startDateISO: string,      // Keep: '2025-10-03'
  startTime: string,         // Keep: '14:30'
  timeZone: string,          // Keep: 'America/New_York'
  startTimestampUTC: string, // ADD: '2025-10-03T18:30:00Z' (computed from above)
  duration: number
}
```

#### Advantages
✅ **Backward compatible**: No breaking changes  
✅ **Gradual migration**: Can compute UTC field lazily  
✅ **Maintains UI compatibility**: Forms still work with date/time fields  
✅ **Query flexibility**: Can query by date OR timestamp  

#### Disadvantages
❌ **Data duplication**: Three fields to represent one datetime  
❌ **Consistency risk**: Fields can get out of sync  
❌ **Maintenance burden**: Must update all three on change  
❌ **Doesn't solve root problem**: Still storing ambiguous date/time  

---

## Recommended Solution: **Solution A (UTC Timestamp + Timezone)**

### Why This Is Best

1. **Correctness First**: Eliminates ambiguity completely
2. **Scalability**: Supports multi-timezone users properly
3. **Industry Standard**: Follows best practices from Stripe, Google Calendar, etc.
4. **Firebase Compatible**: Timestamp fields work well with Firestore
5. **Future-Proof**: Handles timezone rule changes automatically

### Migration Strategy

#### Phase 1: Dual Write (2-4 weeks)
```javascript
// Write BOTH old and new format
Task.create({
  startDateISO: '2025-10-03',
  startTime: '14:30',
  timeZone: 'America/New_York',
  startTimestampUTC: '2025-10-03T18:30:00Z'  // NEW
})
```

#### Phase 2: Backfill (1 week)
```javascript
// Migration script for existing tasks
for (const task of tasks) {
  if (!task.startTimestampUTC && task.startDateISO && task.startTime) {
    const localDT = DateTime.fromFormat(
      `${task.startDateISO} ${task.startTime}`,
      'yyyy-MM-dd HH:mm',
      { zone: task.timeZone || 'America/Los_Angeles' }
    )
    task.startTimestampUTC = localDT.toUTC().toISO()
  }
}
```

#### Phase 3: Update Queries (2 weeks)
```javascript
// OLD
where('startDateISO', '>=', today.toFormat('yyyy-MM-dd'))

// NEW - Option 1: Keep denormalized field
where('startDateISO', '>=', today.toFormat('yyyy-MM-dd'))  // Still works!

// NEW - Option 2: Use timestamp directly
where('startTimestampUTC', '>=', today.toUTC().toISO())
```

#### Phase 4: Update UI Components (2-3 weeks)
```javascript
// In StartTimeDurationNotify.svelte
function handleDateChange(yyyy, mmdd) {
  const localDT = DateTime.fromFormat(
    `${yyyy}-${mmdd} ${taskObject.startTime}`,
    'yyyy-MM-dd HH:mm',
    { zone: taskObject.timeZone }
  )
  Task.update({
    id: taskObject.id,
    keyValueChanges: {
      startTimestampUTC: localDT.toUTC().toISO(),
      startDateISO: localDT.toFormat('yyyy-MM-dd'),  // Cache for queries
      startTime: localDT.toFormat('HH:mm')            // Cache for display
    }
  })
}
```

#### Phase 5: Deprecate Old Fields (Optional, after 3+ months)
- Remove `startDateISO` and `startTime` from writes
- Compute them on-the-fly from `startTimestampUTC`
- Update Zod schema to make old fields optional

### Performance Considerations

**Query Performance**: Keep denormalized `startDateISO` for:
- Calendar view queries: `where('startDateISO', 'in', dateArray)`
- Date range filters in Archive
- Template instance queries

**Display Performance**: Keep denormalized `startTime` for:
- Calendar rendering (avoid converting 100+ tasks on every render)
- Timeline calculations
- Schedule views

**Trade-off**: 
- Extra storage: ~50 bytes per task × 10K tasks = 500KB (negligible)
- Consistency maintenance: Update 3 fields instead of 2
- **Worth it**: Eliminates 100+ DateTime conversions on calendar render

### Breaking Changes & Mitigations

| Component | Impact | Mitigation |
|-----------|--------|------------|
| `checkNotify.js` | Medium | Update to use `startTimestampUTC` directly |
| Calendar queries | Low | Keep `startDateISO` denormalized |
| Template instances | Low | Update `instances.js` to compute timestamp |
| Date comparisons | Low | Use timestamp comparisons |
| RRule generation | Medium | Convert occurrences to UTC timestamps |

### Testing Strategy

1. **Unit Tests**: Test datetime conversions across timezones
2. **DST Tests**: Test tasks scheduled during DST transitions
3. **Migration Tests**: Verify all existing tasks migrate correctly
4. **Query Tests**: Ensure queries return same results
5. **Notification Tests**: Verify notifications fire at correct time

### Rollback Plan

Keep old fields for 6+ months:
```javascript
if (task.startTimestampUTC) {
  // Use new format
} else {
  // Fallback to old format
}
```

## Alternative: Hybrid Solution (Pragmatic)

If migration is too risky, use **Solution C temporarily**:

1. Add `startTimestampUTC` computed field
2. Use UTC timestamp for notifications and cross-timezone features
3. Keep `startDateISO`/`startTime` for queries and UI
4. Gradually migrate over 6-12 months

This gives you correctness where it matters (notifications) while minimizing risk.

## Decision Framework

Choose **Solution A** if:
- ✅ You have time for proper migration (2-3 months)
- ✅ You plan to support international users
- ✅ You want to eliminate timezone bugs permanently
- ✅ You can handle denormalized cache fields

Choose **Solution C** if:
- ⚠️ You need a quick fix for notifications
- ⚠️ You're risk-averse about breaking queries
- ⚠️ You have limited development time
- ⚠️ Your users are mostly in one timezone

**Don't choose Solution B**: It's the worst of both worlds (complexity without benefits).

## Conclusion

**Recommendation**: Implement **Solution A** with denormalized cache fields.

This provides:
1. **Correctness**: No timezone ambiguity
2. **Performance**: Cached fields for fast queries
3. **Maintainability**: Single source of truth (UTC timestamp)
4. **Scalability**: Ready for multi-timezone users

The migration is manageable over 2-3 months with dual-write strategy and proper testing.

Total estimated effort: **3-4 weeks** of development time spread over 2-3 months.
