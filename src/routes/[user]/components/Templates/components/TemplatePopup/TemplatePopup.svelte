<script>
  import PeriodicityEditor from './PeriodicityEditor.svelte'
  import IconsDisplay from '../IconsDisplay/IconsDisplay.svelte'
  import BasePopup from '$lib/components/BasePopup.svelte'
  import MyTimePicker from '$lib/components/MyTimePicker.svelte'
  import MinimalisticInput from '$lib/components/MinimalisticInput.svelte'
  import UXFormTextArea from '$lib/components/UXFormTextArea.svelte'
  import { getPeriodicity } from '$lib/utils/rrule.js'
  import { template, closeTemplateEditor } from '../../store.js'
  import { createDebouncedFunction } from '$lib/utils/core.js'
  import Template from '$lib/db/models/Template.js'

  const debouncedUpdate = createDebouncedFunction(instantUpdate, 1000)

  let iconsMenu = false

  function handleDelete () {
    if (confirm("Are you sure you want to delete this template? This won't affect past task instances but you can choose whether to delete future instances.")) {
      Template.delete({ id: $template.id })
      closeTemplateEditor()
    }
  }

  function formatTime(minutes) {
    if (minutes < 60) return `${Math.round(minutes)} minutes`
    const hours = Math.round(minutes / 60)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }

  function instantUpdate (key, value) {
    Template.updateItselfAndFutureInstances({ id: $template.id, updates: {
      [key]: value
    }})
  }
</script>

<BasePopup on:click-outside={closeTemplateEditor}>
  <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center;">
    {#if getPeriodicity($template.rrStr) === 'weekly'}
      <button on:click={() => iconsMenu = !iconsMenu} class="icon-container" class:active={iconsMenu}>
        {#if $template.iconURL}
          <img src={$template.iconURL} style="width: 100%; height: 100%; border-radius: 50%;" alt="Task icon" />
        {/if}
      </button>
    {/if}

    <input value={$template.name} 
      on:input={e => debouncedUpdate('name', e.target.value)}
      type="text" placeholder="Untitled" style="width: 100%; font-size: 24px;" class="title-underline-input"
    />
  </div>

  <div class="flexbox" style="align-items: center">
    {#await Template.getTotalStats({ id: $template.id })}
      <div class="stats">Loading stats...</div>
    {:then { minutesSpent, timesCompleted }}
      <div class="stats">
        Completed {timesCompleted} times, spent {formatTime(minutesSpent)}
      </div>
    {/await}
  </div>
  
  {#if iconsMenu}
    <IconsDisplay />
  {/if}

  <div style="display: flex; gap: 8px; align-items: start;">
    <div style="flex: 1 1 400px;">
      <UXFormTextArea value={$template.notes}
        on:input={e => debouncedUpdate('notes', e.detail)}
        fieldLabel=""
        placeholder="Notes..."
      />
    </div>

    <div class="flexbox" style="column-gap: 8px; align-items: center; justify-content: center;">
      <MyTimePicker value={$template.startTime}
        on:input={e => debouncedUpdate('startTime', e.detail.typedHHMM)}
        on:time-selected={e => instantUpdate('startTime', e.detail.selectedHHMM)}
      />
      <MinimalisticInput
        value={Math.round($template.duration)}
        on:input={e => instantUpdate("duration", Number(e.target.value))}
      />   
    </div>
  </div>

  <PeriodicityEditor routine={$template} />

  <button on:click|stopPropagation={handleDelete} class="material-symbols-outlined delete-button">
    delete
  </button>
</BasePopup>

<style>
  .title-underline-input { /* @see https://stackoverflow.com/a/3131082/7812829 */
    background: transparent;
    border: none;
    outline: none;
    font-size: 23px;
    font-weight: 700;
    padding-left: 0px;
  }

  .icon-container {
    width: 48px;
    height: 48px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-radius: 50%;
  }
  
  .icon-container.active {
    box-shadow: 0 2px 8px rgba(90, 179, 39, 0.5);
  }

  .delete-button {
    position: absolute;
    bottom: 16px;
    right: 16px;
    border-radius: 50%;
    padding: 4px;
  }

  .stats {
    color: #666;
    font-size: 12px;
    margin: 12px 0;
    line-height: 1.4;
  }
</style>