<!-- re-use the re-ordering logic before deleting this file -->

<script>
  import SimpleDropzone from '$lib/components/SimpleDropzone.svelte'
  import Template from '$lib/db/models/Template.js'
  import { openTemplateEditor } from './store.js'
  import { getDisplayLength } from './utils.js'
  
  export let templates

  let draggedTemplate
  const templateWidthInPx = 180

  function handleDrop (newOrderValue) {
    Template.update({
      id: draggedTemplate.id,
      updates: { orderValue: newOrderValue }
    })
  }
</script>

<div>
  {#each templates as template, i (template.id)}
    {#if i === 0}
      <SimpleDropzone
        on:new-order-value={(e) => handleDrop(e.detail)}
        aboveOrder={0}
        belowOrder={templates[0].orderValue}
      />
      <!-- general case drop-zone: must be between 2 templates-->
    {:else if i > 0 && i < templates.length}
      <SimpleDropzone
        on:new-order-value={(e) => handleDrop(e.detail)}
        aboveOrder={templates[i - 1].orderValue}
        belowOrder={templates[i].orderValue}
      />
    {/if}

    <div 
      on:click={() => openTemplateEditor(template.id)} on:keydown
      on:dragstart|self={(e) => (draggedTemplate = template)}
      draggable="true"
      style="display: flex; align-items: center; cursor: pointer;"
    >
      {#if template.iconURL}
        <!-- svelte-ignore a11y-missing-attribute -->
        <img src={template.iconURL} style="width: 60px; height: 60px;" />
      {:else}
        <div style="width: 60px; height: 60px" />
      {/if}

      <div style="width: {templateWidthInPx}px;">
        <div style="font-size: 16px; font-color: rgb(120, 120, 120)">
          {template.name}
        </div>
        {#if template.totalTasksCompleted}
          <div style="margin-left: 8px;">
            <div
              style="display: flex; align-items: center; margin-top: 8px;
              margin-bottom: 0px; max-width: {templateWidthInPx}px;"
            >
              {#each { length: template.totalTasksCompleted } as _, i}
                <div
                  style="background: green; border-radius: 4px; width: {getDisplayLength(
                    { template, templateWidthInPx }
                  )}px;
                  height: 3px; margin-right: 2px;"
                />
              {/each}
            </div>
            <div
              style="font-weight: 400; font-size: 14px; margin-top: 8px; color:
              green"
            >
            {Math.round((template.totalMinutesSpent / 60) * 10) / 10} hr            </div>
          </div>
        {/if}
      </div>
    </div>

    {#if i === templates.length - 1}
      <SimpleDropzone
        on:new-order-value={(e) => handleDrop(e.detail)}
        aboveOrder={templates[i].orderValue}
        belowOrder={templates[i].orderValue + 1}
      />
    {/if}
  {/each}
</div>