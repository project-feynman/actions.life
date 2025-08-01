<div 
  on:click={() => openTaskPopup(task)}
  draggable="true" 
  on:dragstart|self={(e) => startDragMove(e, task.id)} 
  class="claude-draggable-item"
  class:calendar-block={!isBulletPoint}
  style="
    position: relative;
    height: {height}px; 
    min-height: 12px;
    font-size: {fontSize}rem;
    opacity: {task.isDone ? '0.9' : '0.7'};
    background-color: {isBulletPoint ? '' : 'var(--experimental-black)'};
    background-image: {task.imageDownloadURL ? `url(${task.imageDownloadURL})` : ''};
    background-size: contain;
    background-repeat: no-repeat;
    padding-left: {isBulletPoint ? '0px' : 'var(--left-padding)'};
    padding-right: var(--left-padding);

    display: flex; flex-direction: column;
  " 
  on:keydown={() => {}}
>
  <!-- As long as this parent div is correctly sized, the duration adjusting area 
    will be positioned correctly (it's glued to the bottom of this parent div)

    `min-height` prevents the parent from being super small when it's bullet point mode
  -->
  <div style="display: flex; align-items: center; width: 100%;">
    {#if isBulletPoint}
      <span class="material-icons" 
        style="
          font-size: 2px; 
          margin-right: calc(var(--left-padding) - 2px);
          color: {task.isDone ? '#509c13' : 'rgb(20, 20, 20)'}; 
        "
      >
        circle
      </span>
    {/if}

    {#if hasCheckbox && $treesByID[task.id].children.length === 0}
      <!-- quickfix: it's hard to use flexbox for layouts due to all the if-else cases, so we temporarily use a 4px margin consistent with the to-do  -->
      <div style="margin-right: 4px;">
        <Checkbox
          value={task.isDone}
          on:change={(e) => Task.update({
            id: task.id,
            keyValueChanges: {
              isDone: e.target.checked
            }
          })}
          zoom={0.5}
        />
      </div>
    {/if}

    {#if task.iconURL}
      <img src={task.iconURL} style="pointer-events: none; width: 32px; height: 32px;" alt="task icon">
    {:else}
      <div class="cal-task-name truncate-to-one-line unselectable" 
        style="
          color: {isBulletPoint ? 'black' : 'white'};
          margin-top: -1px;
        "
      >
        {task.name}
      </div>
    {/if}
  </div>
  <!-- End of task name flexbox -->

  {#if !isBulletPoint}
    {#if task.children.length > 0}
      <div style="margin-top: 6px; display: flex; align-items: center; column-gap: 2px; color: white;">
        <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span>
        <span class="font-weight: 200;">
          {task.children.filter(child => child.isDone).length}/{task.children.length}
        </span>
      </div> 
    {/if}

    <div style="flex-grow: 1; overflow: hidden; margin-top: 6px;">
      <div style="font-size: 12px; font-weight: 300; color: {isBulletPoint ? '' : 'white'};">
        {task.notes || ''}
      </div>
    </div>
  {/if}

    <!-- 
      `1vw`: if it's too wide, it overlaps with the task name for short duration tasks 
    -->
    <!-- on:drop preventDefault so that the calendar doesn't think we're scheduling a task -->
    <div draggable="true"
      on:dragstart={(e) => startAdjustingDuration(e)}
      on:dragend={(e) => adjustDuration(e, task)}
      style="
        cursor: ns-resize;
        position: absolute;
        left: -3px; 
        bottom: {0}px;
        height: {height/12}px; 
        min-height: 3px;
        width: {isBulletPoint ? '20%' : '100%'}; 
      "
    >
  </div>
</div>

<script>
  // Assumes `task` is hydrated
  import { getTrueY } from '/src/lib/utils/core.js'
  import Checkbox from './Checkbox.svelte'
  import { treesByID } from '/src/routes/[user]/components/Calendar/service.js'
  import { pixelsPerHour } from '/src/routes/[user]/components/Calendar/store.js'
  import { getContext } from 'svelte'

  const { Task, openTaskPopup, activeDragItem, grabOffset } = getContext('app')

  export let task = null
  export let hasCheckbox = false

  export let fontSize = 1

  $: height = ($pixelsPerHour / 60) * task.duration
  $: isBulletPoint = height < 24 // 24px is exactly enough to not crop the checkbox and the task name

  let startY = 0

  function startDragMove (e, id) {
    e.dataTransfer.setData("text/plain", id)

    // record distance from the top of the element
    const rect = e.target.getBoundingClientRect()
    const y = e.clientY - rect.top // y position within el ement

    activeDragItem.set({
      kind: 'room',
      ...task
    })

    grabOffset.set(y)
  }

  function startAdjustingDuration (e) {
    startY = getTrueY(e)
  }

  function adjustDuration (e, task) {
    const hoursPerPixel = 1 / $pixelsPerHour
    const minutesPerPixel = 60 * hoursPerPixel

    const newY = getTrueY(e)
    const durationChange = minutesPerPixel * (newY - startY)

    Task.update({
      id: task.id,
      keyValueChanges: {
        duration: Math.max(1, task.duration + durationChange)
      }
    })

    activeDragItem.set(null)
  }
</script> 

<style>
  :root {
    --left-padding: 6px;
    --default-task-color: hsla(210, 20%, 36%, 0.6);

    --experimental-purple: hsla(248, 53%, 58%, 0.6);
    --experimental-red: hsla(0, 100%, 50%, 0.6);
  }

  .calendar-block {
    width: 100%;
    padding-top: var(--left-padding);
    border-radius: var(--left-padding);
    cursor: pointer;
  }
</style>