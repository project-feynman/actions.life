<script>
  import { parseYearly } from '$lib/utils/rrule.js'
  import MyJSDatePicker from '$lib/components/MyJSDatePicker.svelte'
  import { onMount, getContext } from 'svelte'

  const inputStates = getContext('inputStates')

  let selectedISO = ''

  onMount(() => {
    const parsedDate = parseYearly($inputStates.yearly)
    if (parsedDate) {
      const { mmdd, year } = parsedDate
      selectedISO = `${year}-${mmdd.replace('/', '-')}`
    }
  })

  function createRRuleFromDate(mmdd) {
    if (!mmdd) return ''
    
    const [month, day] = mmdd.split('/').map(part => parseInt(part))
    return `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day}`
  }

  function handleDateSelected (e) {
    const { yyyy, mmdd } = e.detail
    selectedISO = `${yyyy}-${mmdd.replace('/', '-')}`

    inputStates.update(states => ({ 
      ...states,
      yearly: createRRuleFromDate(mmdd), // NOTE: must be AFTER states, otherwise it gets overriden
    }))
  }
</script>

<div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
  <MyJSDatePicker
    startDateISO={selectedISO}
    on:date-selected={handleDateSelected}
  />
  every year
</div>