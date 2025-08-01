<!-- 
  TO-DO: unify photo-icon vs icon-photo
  I often have icon tasks with a photo (i.e. instantiate a routine, attach photo) 
  but rarely have a photo with an icon. How the app treats both, I have no idea, but it'll have to be addressed in the future. 
-->

<!-- As long as this parent div is correctly sized, the duration adjusting area 
  will be positioned correctly (it's glued to the bottom of this parent div)
  `min-height` prevents the parent from being super small when it's bullet point mode
-->
<div on:click={() => openTaskPopup(task)}
  draggable="true" 
  on:dragstart|self={(e) => startDragMove(e, task.id)} 
  use:lazyCallable={() => hasIntersected = true}
  class:calendar-block={true}
  style="
    position: relative;
    display: flex; 
    flex-direction: column;
    min-height: 24px;
    height: {height}px; 
    font-size: {fontSize}rem;
    opacity: {task.isDone ? '0.9' : '0.7'};
    background-color: {isBulletPoint ? '' : 'var(--experimental-black)'};
    background-image: url({hasIntersected ? task.imageDownloadURL : ''});
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  "
  on:keydown={() => {}}
>
  <div style="display: flex; align-items: center; width: 100%; padding-top: 4px; padding-left: 6px;">
    {#if task.iconURL}
      <img src={task.iconURL} style="pointer-events: none; width: 32px; height: 32px;" alt="task icon">
    {:else if task.name}
      <div class="cal-task-name truncate-to-one-line unselectable" 
        style="color: white;"
      >
        {task.name}
      </div>
    {/if}
  </div>

  <div style="flex-grow: 1; overflow: hidden; margin-left: var(--left-padding); margin-top: 6px;">
    <div style="font-size: 12px; font-weight: 300; color: white;">
      {task.notes || ''}
    </div>
  </div>

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
 import { lazyCallable } from '/src/lib/utils/svelteActions.js'
 import { pixelsPerHour } from '/src/routes/[user]/components/Calendar/store.js'
 import { getContext } from 'svelte'

 const { Task,openTaskPopup, activeDragItem, grabOffset } = getContext('app')

 export let task = null

 export let fontSize = 1

 $: height = ($pixelsPerHour / 60) * task.duration
 $: isBulletPoint = height < 24 // 24px is exactly enough to not crop the checkbox and the task name

 let startY = 0
 let hasIntersected = false

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
   // quickfix
   if (!task.duration) {
     task.duration = 10
   }

   const hoursPerPixel = 1 / $pixelsPerHour
   const minutesPerPixel = 60 * hoursPerPixel

   const newY = getTrueY(e)
   const durationChange = minutesPerPixel * (newY - startY)

   Task.update({
     id: task.id,
     keyValueChanges: {
       duration: Math.max(1, task.duration + durationChange) // can't have a 0 duration event
     }      
   })
 }
</script> 

<style>
 :root {
   --left-padding: 6px;
   --default-task-color: hsla(210, 20%, 36%, 0.6);

   --experimental-black: hsla(0, 100%, 0%, 0.6);
   --experimental-purple: hsla(248, 53%, 58%, 0.6);
   --experimental-red: hsla(0, 100%, 50%, 0.6);
 }

 .calendar-block {
   width: 100%;
   cursor: pointer;
   border-radius: var(--left-padding);
 }
</style>